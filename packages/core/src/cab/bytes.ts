// Bounds-checked little-endian reads over the cabinet bytes (R3.2). Every read outside the input
// throws CORRUPT_CAB with the offset where the read was attempted.

import { AfterlifeError } from '../errors';

export class ByteReader {
  private readonly input: Uint8Array;
  private readonly view: DataView;
  private pos = 0;

  constructor(bytes: Uint8Array) {
    this.input = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get length(): number {
    return this.input.length;
  }

  get offset(): number {
    return this.pos;
  }

  /** Moves to `offset`; the end of the input is a valid position. */
  seek(offset: number, what = 'seek'): this {
    if (!Number.isInteger(offset) || offset < 0 || offset > this.input.length) {
      throw outOfBounds(offset, what, this.input.length);
    }
    this.pos = offset;
    return this;
  }

  u8(what = 'u8'): number {
    const at = this.need(1, what);
    return this.view.getUint8(at);
  }

  u16(what = 'u16'): number {
    const at = this.need(2, what);
    return this.view.getUint16(at, true);
  }

  u32(what = 'u32'): number {
    const at = this.need(4, what);
    return this.view.getUint32(at, true);
  }

  /** The next `n` bytes, as a view (no copy). */
  bytes(n: number, what = 'bytes'): Uint8Array {
    const at = this.need(n, what);
    return this.input.subarray(at, at + n);
  }

  /** Bytes up to the next NUL, which is consumed and not returned. */
  zstring(what = 'string'): Uint8Array {
    const start = this.pos;
    const end = this.input.indexOf(0, start);
    if (end < 0) throw outOfBounds(start, `${what} has no terminating NUL`, this.input.length);
    this.pos = end + 1;
    return this.input.subarray(start, end);
  }

  private need(n: number, what: string): number {
    const at = this.pos;
    if (!Number.isInteger(n) || n < 0 || at + n > this.input.length) {
      throw outOfBounds(at, `${what}: ${n} bytes`, this.input.length);
    }
    this.pos = at + n;
    return at;
  }
}

function outOfBounds(offset: number, what: string, length: number): AfterlifeError<'CORRUPT_CAB'> {
  return new AfterlifeError('CORRUPT_CAB', {
    offset,
    reason: `${what} at offset ${offset} lies outside the ${length}-byte input`,
  });
}
