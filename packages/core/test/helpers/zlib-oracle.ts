// The independent oracle for the inflate spike: folder output from Node's zlib, with the
// previous ≤ 32 KB of output as a preset dictionary for each block (design D2). Tests only.

import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { walkCfData } from './cfdata';
import { readSample } from './samples';

const WINDOW = 32_768;

export function zlibOracleFolder(cab: Uint8Array): Uint8Array {
  const { typeCompress, blocks } = walkCfData(cab);
  if (typeCompress !== 1) throw new Error(`oracle handles MSZIP only, got ${typeCompress}`);
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.cbUncomp, 0));
  let at = 0;
  for (const block of blocks) {
    const history = out.subarray(Math.max(0, at - WINDOW), at);
    const part = inflateRawSync(block.data, history.length ? { dictionary: history } : {});
    if (part.length !== block.cbUncomp) {
      throw new Error(
        `oracle: block at ${block.offset} gave ${part.length}, not ${block.cbUncomp}`,
      );
    }
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** SHA-256 of the oracle's folder output for the cabinet at `path`. */
export function zlibOracleSha256(path: string): string {
  return sha256Hex(zlibOracleFolder(readSample(path)));
}
