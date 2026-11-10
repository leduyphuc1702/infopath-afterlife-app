import { readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readStructures } from '../../src/cab/structures';
import { DEFAULT_LIMITS } from '../../src/limits';
import { writeCabinet } from '../helpers/cab-writer';
import { catchError } from '../helpers/catch-error';
import { readSample, sampleCabinets } from '../helpers/samples';

// Design §6 steps 1–4 on the in-repo cabinets and on synthetic ones (R2.4, R3.1, R3.5).

const text = (s: string) => new TextEncoder().encode(s);

describe('headers of every sample cabinet', () => {
  test.each(sampleCabinets().map((c) => [c.slug, c] as const))('%s', (_slug, cab) => {
    const { header, folders, files } = readStructures(readSample(cab.path), DEFAULT_LIMITS);
    expect(header).toMatchObject({ versionMajor: 1, versionMinor: 3, flags: 0, cFolders: 1 });
    expect(folders).toHaveLength(1);
    expect(folders[0]!.compression).toBe('mszip');
    expect(files.every((f) => f.folder === 0)).toBe(true);
    if (cab.formsDir) {
      expect(files.map((f) => f.name).sort()).toEqual(readdirSync(cab.formsDir).sort());
    } else {
      expect(files).toHaveLength(6);
    }
  });
});

describe('synthetic structures', () => {
  const files = [
    { name: 'manifest.xsf', bytes: text('m'.repeat(100)), date: 0x1111, time: 0x2222 },
    { name: 'b.xsd', bytes: text('b'.repeat(40)), attributes: 0xa0 },
  ];

  test('fields, offsets and sizes come back as written', () => {
    const { bytes, layout } = writeCabinet(files);
    const s = readStructures(bytes, DEFAULT_LIMITS);
    expect(s.header).toMatchObject({
      cFiles: 2,
      setId: 0x1234,
      cabinetIndex: 0,
      coffFiles: layout.files[0],
    });
    expect(s.folders[0]).toMatchObject({
      index: 0,
      offset: layout.folders[0],
      coffCabStart: layout.blocks[0]![0],
      cCFData: 1,
    });
    expect(s.files).toEqual([
      {
        offset: layout.files[0],
        name: 'manifest.xsf',
        size: 100,
        uoffFolderStart: 0,
        folder: 0,
        date: 0x1111,
        time: 0x2222,
        attributes: 0x20,
      },
      {
        offset: layout.files[1],
        name: 'b.xsd',
        size: 40,
        uoffFolderStart: 100,
        folder: 0,
        date: 0x5b6a,
        time: 0x6000,
        attributes: 0xa0,
      },
    ]);
  });

  test('reserve areas (flag 0x0004) are skipped', () => {
    const plain = readStructures(writeCabinet(files).bytes, DEFAULT_LIMITS);
    const { bytes } = writeCabinet(files, { reserve: { header: 20, folder: 7, data: 3 } });
    const reserved = readStructures(bytes, DEFAULT_LIMITS);
    expect(reserved.header).toMatchObject({ flags: 4, cbCFFolder: 7, cbCFData: 3 });
    expect(reserved.files.map((f) => ({ ...f, offset: 0 }))).toEqual(
      plain.files.map((f) => ({ ...f, offset: 0 })),
    );
  });

  test('a reserve flag with no reserve bytes reads normally', () => {
    const { bytes } = writeCabinet(files, { reserve: {} });
    expect(readStructures(bytes, DEFAULT_LIMITS).files.map((f) => f.name)).toEqual([
      'manifest.xsf',
      'b.xsd',
    ]);
  });

  test('a version other than 1.3 is read and reported, not refused', () => {
    const { bytes } = writeCabinet(files, { header: { versionMajor: 2, versionMinor: 0 } });
    expect(readStructures(bytes, DEFAULT_LIMITS).header).toMatchObject({
      versionMajor: 2,
      versionMinor: 0,
    });
  });

  test('a file in a folder that does not exist is CORRUPT_CAB at its CFFILE entry (R3.5)', () => {
    const { bytes, layout } = writeCabinet(files, { fileFields: { 1: { iFolder: 1 } } });
    expect(catchError(() => readStructures(bytes, DEFAULT_LIMITS))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: layout.files[1] },
    });
  });

  test('a cabinet that is not MSCF is CORRUPT_CAB at offset 0 (R3.1)', () => {
    for (const bytes of [
      new Uint8Array(0),
      text('MSC'),
      text('MSCX'.padEnd(40, '\0')),
      text('PK\x03\x04'),
    ]) {
      expect(() => readStructures(bytes, DEFAULT_LIMITS)).toThrow(
        expect.objectContaining({
          code: 'CORRUPT_CAB',
          details: { offset: 0, reason: 'no MSCF signature' },
        }),
      );
    }
  });

  test('coffFiles past the end is CORRUPT_CAB at that offset', () => {
    const { bytes } = writeCabinet(files, { header: { coffFiles: 99_999 } });
    expect(catchError(() => readStructures(bytes, DEFAULT_LIMITS))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: 99_999 },
    });
  });
});
