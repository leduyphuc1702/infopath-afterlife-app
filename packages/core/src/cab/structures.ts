// CFHEADER, CFFOLDER and CFFILE parsing (design §6 steps 1–4; R2, R3.1–3.2, R3.5, R4.1–4.3).
// No data blocks here: every check that must happen before inflation happens in this file.

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
}

export interface CabFolder {
  readonly index: number;
  /** Offset of the CFFOLDER entry. */
  readonly offset: number;
  readonly coffCabStart: number;
  readonly cCFData: number;
  readonly compression: 'none' | 'mszip';
}

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
  const folders: CabFolder[] = [];
  for (let index = 0; index < cFolders; index++) {
    const offset = r.offset;
    const coffCabStart = r.u32('CFFOLDER.coffCabStart');
    const cCFData = r.u16('CFFOLDER.cCFData');
    const typeCompress = r.u16('CFFOLDER.typeCompress');
    r.bytes(cbCFFolder, 'CFFOLDER.abReserve');
    folders.push({
      index,
      offset,
      coffCabStart,
      cCFData,
      compression: compression(typeCompress, index),
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
    },
    folders,
    files,
  };
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
