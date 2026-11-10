import { describe, expect, test } from 'vitest';
import { readStructures } from '../../src/cab/structures';
import { AfterlifeError } from '../../src/errors';
import { DEFAULT_LIMITS } from '../../src/limits';
import { writeCabinet } from '../helpers/cab-writer';

// R2.1–R2.5: synthetic headers; no LZX or Quantum encoder is needed.

const files = [{ name: 'manifest.xsf', bytes: new TextEncoder().encode('<x/>') }];

function failure(bytes: Uint8Array): AfterlifeError {
  try {
    readStructures(bytes, DEFAULT_LIMITS);
  } catch (e) {
    expect(e).toBeInstanceOf(AfterlifeError);
    return e as AfterlifeError;
  }
  throw new Error('expected an AfterlifeError');
}

describe('compression types (R2.1, R2.2)', () => {
  test.each([
    [0x0002, 'Quantum'],
    [0x0003, 'LZX'],
    [0x1503, 'LZX'], // LZX with a 2^21 window in the high byte
    [0x0042, 'Quantum'],
  ] as const)('typeCompress %i names %s and the folder index', (type, method) => {
    const { bytes } = writeCabinet(files, { folderFields: { 0: { typeCompress: type } } });
    const err = failure(bytes);
    expect(err.code).toBe('UNSUPPORTED_COMPRESSION');
    expect(err.details).toEqual({ method, folder: 0 });
  });

  test.each([4, 7, 15])('type %i gives the number', (type) => {
    const { bytes } = writeCabinet(files, { folderFields: { 0: { typeCompress: type } } });
    expect(failure(bytes).details).toEqual({ method: type, folder: 0 });
  });

  test('a later folder is named by its index', () => {
    const { bytes } = writeCabinet(files, {
      folders: [{}, {}, { compression: 3 }],
    });
    expect(failure(bytes).details).toEqual({ method: 'LZX', folder: 2 });
  });

  test('every folder is checked before any data is read: garbage blocks do not matter', () => {
    const { bytes } = writeCabinet(files, {
      folders: [{}, { compression: 3 }],
      blockFields: { '0:0': { ab: new Uint8Array([0xff, 0xff, 0xff]) } },
    });
    expect(failure(bytes).code).toBe('UNSUPPORTED_COMPRESSION');
  });
});

describe('header flags (R2.3, R2.4)', () => {
  test.each([
    [0x0001, 'prevCabinet'],
    [0x0002, 'nextCabinet'],
    [0x0003, 'prevCabinet'],
    [0x0007, 'prevCabinet'],
  ] as const)('flags %i give UNSUPPORTED_CAB with %s', (flags, feature) => {
    const err = failure(writeCabinet(files, { flags }).bytes);
    expect(err.code).toBe('UNSUPPORTED_CAB');
    expect(err.details).toEqual({ feature });
  });

  test('flag 0x0004 reads normally', () => {
    const { bytes } = writeCabinet(files, { reserve: { header: 255, folder: 255, data: 255 } });
    expect(readStructures(bytes, DEFAULT_LIMITS).files.map((f) => f.name)).toEqual([
      'manifest.xsf',
    ]);
  });
});
