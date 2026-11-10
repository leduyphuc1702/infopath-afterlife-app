// readCabinet (design §6 steps 6–7; R1, R3.3–R3.6). readStructures first (every check that must
// precede inflation, block headers included), then the blocks of each folder inflated with fresh
// history, then each file sliced from its folder's output.

import { AfterlifeError, type Issue } from '../errors';
import { resolveLimits, type ParseOptions } from '../limits';
import { cfDataChecksum } from './checksum';
import { WINDOW, inflateBlock } from './inflate';
import { readStructures, type CabFolder } from './structures';

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

  const outputs: Uint8Array[] = [];
  for (const folder of folders) {
    outputs.push(await readFolder(bytes, folder, issues));
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
  issues: Issue[],
): Promise<Uint8Array> {
  const result = new Uint8Array(folder.blocks.reduce((n, b) => n + b.cbUncomp, 0));
  let history: Uint8Array = new Uint8Array(0);
  let at = 0;

  for (const b of folder.blocks) {
    const data = bytes.subarray(b.dataStart, b.dataStart + b.cbData);
    // readStructures has checked CK, the stored length and every limit.
    const out =
      folder.compression === 'mszip'
        ? await inflateBlock(data.subarray(2), history, b.cbUncomp, b.offset)
        : data;

    // Only a block that decoded to the right length gets here, so a mismatch is not fatal (R3.4).
    if (b.csum !== 0) {
      const computed = cfDataChecksum(bytes.subarray(b.offset + 4, b.dataStart), data);
      if (computed !== b.csum) {
        issues.push({
          code: 'CHECKSUM_MISMATCH',
          message: `CFDATA checksum at offset ${b.offset} is ${hex(b.csum)}; the block gives ${hex(computed)}`,
          offset: b.offset,
          details: { stored: b.csum, computed },
        });
      }
    }

    result.set(out, at);
    at += out.length;
    history = tail(history, out);
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
