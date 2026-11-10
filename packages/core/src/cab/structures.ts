// CFHEADER, CFFOLDER, CFFILE and CFDATA headers (design §6 steps 1–5; R2, R3.1–3.3, R3.5,
// R3.7–3.8, R4.1–4.4, R4.7). Nothing is inflated here: every check that must happen before the
// first inflation happens in this file, so readCabinet only inflates, checksums and slices.

import { AfterlifeError } from '../errors';
import type { Limits } from '../limits';
import { ByteReader } from './bytes';

const MSCF = [0x4d, 0x53, 0x43, 0x46];

const FLAG_PREV_CABINET = 0x0001;
const FLAG_NEXT_CABINET = 0x0002;
const FLAG_RESERVE_PRESENT = 0x0004;

/** CFFILE attribute: the name is UTF-8 (R1.4). */
export const ATTRIB_NAME_IS_UTF = 0x80;

export interface CabHeader {
  readonly versionMinor: number;
  readonly versionMajor: number;
  readonly cFolders: number;
  readonly cFiles: number;
  readonly flags: number;
  readonly setId: number;
  readonly cabinetIndex: number;
  readonly coffFiles: number;
  /** Per-folder reserve size (0 without flag 0x0004). */
  readonly cbCFFolder: number;
  /** Per-block reserve size (0 without flag 0x0004). */
  readonly cbCFData: number;
  /** End of the CFFILE area: the area is `[coffFiles, filesEnd)`. */
  readonly filesEnd: number;
}

/** MSZIP's largest block (R4.4). */
export const MAX_BLOCK = 32_768;

export interface CabBlock {
  /** Offset of the CFDATA header. */
  readonly offset: number;
  readonly csum: number;
  readonly cbData: number;
  readonly cbUncomp: number;
  /** Offset of the block data (after the header and its reserve). */
  readonly dataStart: number;
}

export interface CabFolder {
  readonly index: number;
  /** Offset of the CFFOLDER entry. */
  readonly offset: number;
  readonly coffCabStart: number;
  readonly cCFData: number;
  readonly compression: 'none' | 'mszip';
  /** Its CFDATA blocks, walked and checked; nothing inflated (step 5). */
  readonly blocks: readonly CabBlock[];
  /** End of its last block: the folder's data range is `[coffCabStart, end)`. */
  readonly end: number;
}

type FolderEntry = Omit<CabFolder, 'blocks' | 'end'>;

export interface CabFileEntry {
  /** Offset of the CFFILE entry. */
  readonly offset: number;
  readonly name: string;
  readonly size: number;
  readonly uoffFolderStart: number;
  readonly folder: number;
  readonly date: number;
  readonly time: number;
  readonly attributes: number;
}

export interface CabStructures {
  readonly header: CabHeader;
  readonly folders: readonly CabFolder[];
  readonly files: readonly CabFileEntry[];
}

const utf8 = new TextDecoder('utf-8');
const windows1252 = new TextDecoder('windows-1252');

export function readStructures(bytes: Uint8Array, limits: Limits): CabStructures {
  // Step 1: input size, then signature (R4.3, R3.1).
  if (bytes.length > limits.inputBytes) {
    throw new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'inputBytes',
      max: limits.inputBytes,
      observed: bytes.length,
    });
  }
  if (bytes.length < 4 || MSCF.some((b, i) => bytes[i] !== b)) {
    throw new AfterlifeError('CORRUPT_CAB', { offset: 0, reason: 'no MSCF signature' });
  }

  // Step 2: header (R2.3, R2.4, R4.2).
  const r = new ByteReader(bytes);
  r.seek(4);
  r.u32('CFHEADER.reserved1');
  r.u32('CFHEADER.cbCabinet');
  r.u32('CFHEADER.reserved2');
  const coffFiles = r.u32('CFHEADER.coffFiles');
  r.u32('CFHEADER.reserved3');
  const versionMinor = r.u8('CFHEADER.versionMinor');
  const versionMajor = r.u8('CFHEADER.versionMajor');
  const cFolders = r.u16('CFHEADER.cFolders');
  const cFiles = r.u16('CFHEADER.cFiles');
  const flags = r.u16('CFHEADER.flags');
  const setId = r.u16('CFHEADER.setID');
  const cabinetIndex = r.u16('CFHEADER.iCabinet');

  if (flags & FLAG_PREV_CABINET) {
    throw new AfterlifeError('UNSUPPORTED_CAB', { feature: 'prevCabinet' });
  }
  if (flags & FLAG_NEXT_CABINET) {
    throw new AfterlifeError('UNSUPPORTED_CAB', { feature: 'nextCabinet' });
  }

  let cbCFFolder = 0;
  let cbCFData = 0;
  if (flags & FLAG_RESERVE_PRESENT) {
    const cbCFHeader = r.u16('CFHEADER.cbCFHeader');
    cbCFFolder = r.u8('CFHEADER.cbCFFolder');
    cbCFData = r.u8('CFHEADER.cbCFData');
    r.bytes(cbCFHeader, 'CFHEADER.abReserve');
  }

  if (cFiles > limits.entries) {
    throw new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'entries',
      max: limits.entries,
      observed: cFiles,
    });
  }

  // Step 3: folders; every compression type is checked before anything is inflated (R2.1, R2.2).
  const entries: FolderEntry[] = [];
  let declaredBlocks = 0;
  for (let index = 0; index < cFolders; index++) {
    const offset = r.offset;
    const coffCabStart = r.u32('CFFOLDER.coffCabStart');
    const cCFData = r.u16('CFFOLDER.cCFData');
    const typeCompress = r.u16('CFFOLDER.typeCompress');
    r.bytes(cbCFFolder, 'CFFOLDER.abReserve');
    entries.push({
      index,
      offset,
      coffCabStart,
      cCFData,
      compression: compression(typeCompress, index),
    });
    declaredBlocks += cCFData;
  }
  // R4.7: from the declared counts, before any block header is read.
  if (declaredBlocks > limits.blocks) {
    throw new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'blocks',
      max: limits.blocks,
      observed: declaredBlocks,
    });
  }

  // Step 4: files (R1.4, R3.5, R4.1).
  r.seek(coffFiles, 'CFHEADER.coffFiles');
  const files: CabFileEntry[] = [];
  let declared = 0;
  for (let i = 0; i < cFiles; i++) {
    const offset = r.offset;
    const size = r.u32('CFFILE.cbFile');
    const uoffFolderStart = r.u32('CFFILE.uoffFolderStart');
    const folder = r.u16('CFFILE.iFolder');
    const date = r.u16('CFFILE.date');
    const time = r.u16('CFFILE.time');
    const attributes = r.u16('CFFILE.attribs');
    const nameBytes = r.zstring('CFFILE.szName');
    if (folder >= cFolders) {
      throw new AfterlifeError('CORRUPT_CAB', {
        offset,
        reason: `file ${i} refers to folder ${folder}; the cabinet has ${cFolders}`,
      });
    }
    const name = (attributes & ATTRIB_NAME_IS_UTF ? utf8 : windows1252).decode(nameBytes);
    files.push({ offset, name, size, uoffFolderStart, folder, date, time, attributes });
    declared += size;
  }
  if (declared > limits.uncompressedBytes) {
    throw new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'uncompressedBytes',
      max: limits.uncompressedBytes,
      observed: declared,
    });
  }
  const filesEnd = r.offset;

  // Step 5a: walk every block header of every folder, bounds only (R3.2).
  const folders: CabFolder[] = entries.map((f) => walkBlocks(r, f, cbCFData));
  // Step 5b: no two folders share bytes, and none overlaps the CFFILE area (R3.7).
  checkOverlaps(folders, coffFiles, filesEnd);
  // Step 5c: per-block checks, still before any inflation (R3.3, R3.8, R4.1, R4.4).
  checkBlocks(bytes, folders, limits);

  return {
    header: {
      versionMinor,
      versionMajor,
      cFolders,
      cFiles,
      flags,
      setId,
      cabinetIndex,
      coffFiles,
      cbCFFolder,
      cbCFData,
      filesEnd,
    },
    folders,
    files,
  };
}

function walkBlocks(r: ByteReader, folder: FolderEntry, cbCFData: number): CabFolder {
  r.seek(folder.coffCabStart, `CFFOLDER[${folder.index}].coffCabStart`);
  const blocks: CabBlock[] = [];
  for (let i = 0; i < folder.cCFData; i++) {
    const offset = r.offset;
    const csum = r.u32('CFDATA.csum');
    const cbData = r.u16('CFDATA.cbData');
    const cbUncomp = r.u16('CFDATA.cbUncomp');
    r.bytes(cbCFData, 'CFDATA.abReserve');
    const dataStart = r.offset;
    r.bytes(cbData, 'CFDATA.ab');
    blocks.push({ offset, csum, cbData, cbUncomp, dataStart });
  }
  return { ...folder, blocks, end: r.offset };
}

interface Range {
  readonly start: number;
  readonly end: number;
  /** -1 for the CFFILE area, else the folder index. */
  readonly index: number;
}

/**
 * Sweep over the non-empty ranges sorted by start (the CFFILE area first on a tie, then by folder
 * index). `offset` is the start of the range that starts later, `otherOffset` the start of the
 * earlier range it runs into.
 */
function checkOverlaps(folders: readonly CabFolder[], coffFiles: number, filesEnd: number): void {
  const ranges: Range[] = folders
    .filter((f) => f.end > f.coffCabStart)
    .map((f) => ({ start: f.coffCabStart, end: f.end, index: f.index }));
  if (filesEnd > coffFiles) ranges.push({ start: coffFiles, end: filesEnd, index: -1 });
  ranges.sort((a, b) => a.start - b.start || a.index - b.index);

  let reach: Range | undefined;
  for (const range of ranges) {
    if (reach && range.start < reach.end) {
      throw new AfterlifeError('CORRUPT_CAB', {
        offset: range.start,
        otherOffset: reach.start,
        reason: `${describe(range)} overlaps ${describe(reach)}`,
      });
    }
    if (!reach || range.end > reach.end) reach = range;
  }
}

function describe(r: Range): string {
  const span = `[${r.start}, ${r.end})`;
  return r.index < 0 ? `the CFFILE area ${span}` : `the CFDATA of folder ${r.index} ${span}`;
}

function checkBlocks(bytes: Uint8Array, folders: readonly CabFolder[], limits: Limits): void {
  let total = 0;
  for (const folder of folders) {
    for (const b of folder.blocks) {
      const offset = b.offset;
      if (b.cbUncomp > MAX_BLOCK) {
        throw new AfterlifeError('CORRUPT_CAB', {
          offset,
          reason: `block declares ${b.cbUncomp} uncompressed bytes; MSZIP allows ${MAX_BLOCK}`,
        });
      }
      if (b.cbUncomp === 0) {
        throw new AfterlifeError('CORRUPT_CAB', {
          offset,
          reason: 'block declares 0 uncompressed bytes',
        });
      }
      total += b.cbUncomp;
      if (total > limits.uncompressedBytes) {
        throw new AfterlifeError('LIMIT_EXCEEDED', {
          limit: 'uncompressedBytes',
          max: limits.uncompressedBytes,
          observed: total,
        });
      }
      if (folder.compression === 'mszip') {
        if (b.cbData < 2 || bytes[b.dataStart] !== 0x43 || bytes[b.dataStart + 1] !== 0x4b) {
          throw new AfterlifeError('CORRUPT_CAB', {
            offset,
            reason: 'MSZIP block has no CK signature',
          });
        }
      } else if (b.cbData !== b.cbUncomp) {
        throw new AfterlifeError('CORRUPT_CAB', {
          offset,
          reason: `stored block has ${b.cbData} data bytes but declares ${b.cbUncomp}`,
        });
      }
    }
  }
}

function compression(typeCompress: number, folder: number): 'none' | 'mszip' {
  const type = typeCompress & 0x000f;
  switch (type) {
    case 0:
      return 'none';
    case 1:
      return 'mszip';
    case 2:
      throw new AfterlifeError('UNSUPPORTED_COMPRESSION', { method: 'Quantum', folder });
    case 3:
      throw new AfterlifeError('UNSUPPORTED_COMPRESSION', { method: 'LZX', folder });
    default:
      throw new AfterlifeError('UNSUPPORTED_COMPRESSION', { method: type, folder });
  }
}
