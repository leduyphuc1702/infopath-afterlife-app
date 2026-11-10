import { describe, expect, test } from 'vitest';
import { ByteReader } from '../../src/cab/bytes';
import { AfterlifeError } from '../../src/errors';

// R3.2: every read outside the input is CORRUPT_CAB with the offset where it was attempted.

const input = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x00]);

function corruptAt(fn: () => unknown): number {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AfterlifeError);
    const err = e as AfterlifeError<'CORRUPT_CAB'>;
    expect(err.code).toBe('CORRUPT_CAB');
    expect(err.details.reason).toMatch(/outside the [0-9]+-byte input|no terminating NUL/);
    return err.details.offset;
  }
  throw new Error('expected CORRUPT_CAB');
}

describe('little-endian reads', () => {
  test('u8, u16, u32 advance the offset', () => {
    const r = new ByteReader(input);
    expect(r.u8()).toBe(0x01);
    expect(r.u16()).toBe(0x0302);
    expect(r.u32()).toBe(0x07060504);
    expect(r.offset).toBe(7);
    expect(r.length).toBe(8);
  });

  test('u32 reads the high bit unsigned', () => {
    expect(new ByteReader(new Uint8Array([0xff, 0xff, 0xff, 0xff])).u32()).toBe(0xffffffff);
  });

  test('a view over part of a buffer reads from its own start', () => {
    const big = new Uint8Array([9, 9, 0x34, 0x12, 9]);
    expect(new ByteReader(big.subarray(2, 4)).u16()).toBe(0x1234);
  });
});

describe('boundaries', () => {
  test.each([
    ['u8', 1],
    ['u16', 2],
    ['u32', 4],
  ] as const)('%s ending exactly at the end succeeds; one byte later fails', (kind, size) => {
    const r = new ByteReader(input);
    r.seek(8 - size);
    expect(() => r[kind]()).not.toThrow();
    expect(r.offset).toBe(8);
    expect(corruptAt(() => new ByteReader(input).seek(8 - size + 1)[kind]())).toBe(8 - size + 1);
  });

  test('a read at the end fails at that offset', () => {
    expect(corruptAt(() => new ByteReader(input).seek(8).u8())).toBe(8);
  });

  test('a failed read does not move the offset', () => {
    const r = new ByteReader(input).seek(6);
    corruptAt(() => r.u32());
    expect(r.offset).toBe(6);
  });

  test('bytes(n) returns a view and fails past the end', () => {
    const r = new ByteReader(input).seek(2);
    expect([...r.bytes(3)]).toEqual([3, 4, 5]);
    expect([...r.bytes(0)]).toEqual([]);
    expect(corruptAt(() => r.bytes(4))).toBe(5);
    expect(corruptAt(() => r.bytes(-1))).toBe(5);
  });

  test('seek accepts 0 and the end, refuses outside and non-integers', () => {
    const r = new ByteReader(input);
    expect(r.seek(0).offset).toBe(0);
    expect(r.seek(8).offset).toBe(8);
    expect(corruptAt(() => r.seek(9))).toBe(9);
    expect(corruptAt(() => r.seek(-1))).toBe(-1);
    expect(corruptAt(() => r.seek(1.5))).toBe(1.5);
  });

  test('an empty input fails at offset 0', () => {
    expect(corruptAt(() => new ByteReader(new Uint8Array(0)).u8())).toBe(0);
  });

  test('zstring reads to the NUL, and fails without one at the string start', () => {
    const r = new ByteReader(input).seek(4);
    expect([...r.zstring()]).toEqual([5, 6, 7]);
    expect(r.offset).toBe(8);
    expect(corruptAt(() => new ByteReader(input.subarray(0, 7)).seek(2).zstring())).toBe(2);
  });
});
