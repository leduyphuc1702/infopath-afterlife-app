// One MSZIP block through DecompressionStream('deflate-raw'), with the deflate history of the
// previous blocks in the folder supplied as a stored-block prefix (design §6.1, D1–D3; R1.2,
// R17.2). No CAB parsing here: `data` is the block after its `CK` signature.

import { AfterlifeError } from '../errors';

/** Deflate window: MSZIP history never reaches back further than this. */
export const WINDOW = 32_768;

/**
 * A non-final stored deflate block holding `history` (BFINAL=0, BTYPE=00): the byte `0x00`, then
 * LEN and ~LEN little-endian, then the bytes. Only the last {@link WINDOW} bytes are used.
 */
export function storedBlock(history: Uint8Array): Uint8Array<ArrayBuffer> {
  const h = lastWindow(history);
  const out = new Uint8Array(5 + h.length);
  const len = h.length;
  out[0] = 0x00;
  out[1] = len & 0xff;
  out[2] = len >>> 8;
  out[3] = ~len & 0xff;
  out[4] = (~len >>> 8) & 0xff;
  out.set(h, 5);
  return out;
}

/**
 * Inflates one block. Returns exactly `expected` bytes or throws `CORRUPT_CAB` (R3.3). An
 * inflater error after all expected bytes have come out is ignored (D3), because whether junk
 * after the stream raises one depends on the runtime (D1). `offset` is the block's offset in the
 * cabinet, reported in the error.
 */
export async function inflateBlock(
  data: Uint8Array,
  history: Uint8Array,
  expected: number,
  offset = 0,
): Promise<Uint8Array<ArrayBuffer>> {
  const h = lastWindow(history);
  const input = new Uint8Array(h.length ? 5 + h.length + data.length : data.length);
  if (h.length) {
    input.set(storedBlock(h), 0);
    input.set(data, 5 + h.length);
  } else {
    input.set(data, 0);
  }
  const target = h.length + expected;

  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  // Write errors surface on the readable side too; swallow them here so none goes unhandled.
  const written = writer
    .write(input)
    .then(() => writer.close())
    .catch(() => undefined);
  const reader = stream.readable.getReader();

  const chunks: Uint8Array[] = [];
  let produced = 0;
  let failure: string | undefined;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      produced += value.length;
      if (produced > target) {
        failure = `inflated past ${expected} bytes`;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }
  } catch {
    if (produced !== target) failure = `inflate error after ${produced - h.length} bytes`;
  }
  await written;

  if (failure === undefined && produced !== target) {
    failure = `inflated to ${Math.max(0, produced - h.length)} bytes, expected ${expected}`;
  }
  if (failure !== undefined) {
    throw new AfterlifeError('CORRUPT_CAB', { offset, reason: failure });
  }

  const out = new Uint8Array(expected);
  let skip = h.length;
  let at = 0;
  for (const chunk of chunks) {
    if (skip >= chunk.length) {
      skip -= chunk.length;
      continue;
    }
    const part = chunk.subarray(skip);
    skip = 0;
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function lastWindow(history: Uint8Array): Uint8Array {
  return history.length > WINDOW ? history.subarray(history.length - WINDOW) : history;
}
