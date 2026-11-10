// readCabinet (design §6 steps 5–6; R1, R3.2–R3.6, R4.1, R4.4). Structures first (every check
// that must precede inflation), then the data blocks of each folder with fresh history, then
// each file sliced from its folder's output.

import { AfterlifeError, type Issue } from '../errors';
import { resolveLimits, type Limits, type ParseOptions } from '../limits';
import { ByteReader } from './bytes';
import { cfDataChecksum } from './checksum';
import { WINDOW, inflateBlock } from './inflate';
import { readStructures, type CabFolder } from './structures';

/** MSZIP's largest block (R4.4). */
const MAX_BLOCK = 32_768;

export interface CabinetInfo {
  readonly versionMajor: number;
  readonly versionMinor: number;
  readonly flags: number;
  readonly setId: number;
  readonly cabinetIndex: number;
  readonly folders: readonly {
    readonly compression: 'none' | 'mszip';
    readonly blocks: number;
    readonly offset: number;
  }[];
}

export interface PackageFile {
  /** Decoded per R1.4. */
  readonly name: string;
  readonly size: number;
  /** Raw MS-DOS date and time values; no Date objects, for determinism. */
  readonly date: number;
  readonly time: number;
  readonly attributes: number;
  readonly folder: number;
  readonly bytes: Uint8Array;
}

export interface Cabinet {
  readonly info: CabinetInfo;
  /** CFFILE order (R1.5). */
  readonly files: readonly PackageFile[];
  readonly issues: readonly Issue[];
}

export async function readCabinet(bytes: Uint8Array, options?: ParseOptions): Promise<Cabinet> {
  const limits = resolveLimits(options?.limits);
  const { header, folders, files } = readStructures(bytes, limits);
  const issues: Issue[] = [];
  const budget = { used: 0 };

  const outputs: Uint8Array[] = [];
  for (const folder of folders) {
    outputs.push(await readFolder(bytes, folder, header.cbCFData, limits, budget, issues));
  }

  const result: PackageFile[] = files.map((f) => {
    const out = outputs[f.folder]!;
    const end = f.uoffFolderStart + f.size;
    if (end > out.length) {
      throw new AfterlifeError('CORRUPT_CAB', {
        offset: f.offset,
        reason: `file ${f.name} spans [${f.uoffFolderStart}, ${end}) but folder ${f.folder} holds ${out.length} bytes`,
      });
    }
    return {
      name: f.name,
      size: f.size,
      date: f.date,
      time: f.time,
      attributes: f.attributes,
      folder: f.folder,
      bytes: out.slice(f.uoffFolderStart, end),
    };
  });

  return {
    info: {
      versionMajor: header.versionMajor,
      versionMinor: header.versionMinor,
      flags: header.flags,
      setId: header.setId,
      cabinetIndex: header.cabinetIndex,
      folders: folders.map((f) => ({
        compression: f.compression,
        blocks: f.cCFData,
        offset: f.coffCabStart,
      })),
    },
    files: result,
    issues,
  };
}

async function readFolder(
  bytes: Uint8Array,
  folder: CabFolder,
  cbCFData: number,
  limits: Limits,
  budget: { used: number },
  issues: Issue[],
): Promise<Uint8Array> {
  const r = new ByteReader(bytes);
  r.seek(folder.coffCabStart, `CFFOLDER[${folder.index}].coffCabStart`);
  const chunks: Uint8Array[] = [];
  let history: Uint8Array = new Uint8Array(0);
  let total = 0;

  for (let i = 0; i < folder.cCFData; i++) {
    const offset = r.offset;
    const csum = r.u32('CFDATA.csum');
    const cbData = r.u16('CFDATA.cbData');
    const cbUncomp = r.u16('CFDATA.cbUncomp');
    r.bytes(cbCFData, 'CFDATA.abReserve');
    const data = r.bytes(cbData, 'CFDATA.ab');

    if (cbUncomp > MAX_BLOCK) {
      throw new AfterlifeError('CORRUPT_CAB', {
        offset,
        reason: `block declares ${cbUncomp} uncompressed bytes; MSZIP allows ${MAX_BLOCK}`,
      });
    }
    if (budget.used + cbUncomp > limits.uncompressedBytes) {
      throw new AfterlifeError('LIMIT_EXCEEDED', {
        limit: 'uncompressedBytes',
        max: limits.uncompressedBytes,
        observed: budget.used + cbUncomp,
      });
    }

    let out: Uint8Array;
    if (folder.compression === 'mszip') {
      if (cbData < 2 || data[0] !== 0x43 || data[1] !== 0x4b) {
        throw new AfterlifeError('CORRUPT_CAB', {
          offset,
          reason: 'MSZIP block has no CK signature',
        });
      }
      out = await inflateBlock(data.subarray(2), history, cbUncomp, offset);
    } else {
      if (cbData !== cbUncomp) {
        throw new AfterlifeError('CORRUPT_CAB', {
          offset,
          reason: `stored block has ${cbData} data bytes but declares ${cbUncomp}`,
        });
      }
      out = data;
    }

    // Only a block that decoded to the right length gets here, so a mismatch is not fatal (R3.4).
    if (csum !== 0) {
      const computed = cfDataChecksum(bytes.subarray(offset + 4, offset + 8 + cbCFData), data);
      if (computed !== csum) {
        issues.push({
          code: 'CHECKSUM_MISMATCH',
          message: `CFDATA checksum at offset ${offset} is ${hex(csum)}; the block gives ${hex(computed)}`,
          offset,
          details: { stored: csum, computed },
        });
      }
    }

    chunks.push(out);
    total += out.length;
    budget.used += out.length;
    history = tail(history, out);
  }

  const result = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    result.set(c, at);
    at += c.length;
  }
  return result;
}

/** The last {@link WINDOW} bytes of `history` followed by `next`. */
function tail(history: Uint8Array, next: Uint8Array): Uint8Array {
  if (next.length >= WINDOW) return next.subarray(next.length - WINDOW);
  const keep = Math.min(history.length, WINDOW - next.length);
  const out = new Uint8Array(keep + next.length);
  out.set(history.subarray(history.length - keep), 0);
  out.set(next, keep);
  return out;
}

function hex(n: number): string {
  return `0x${n.toString(16).padStart(8, '0')}`;
}
