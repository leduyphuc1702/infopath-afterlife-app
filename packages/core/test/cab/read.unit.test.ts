import { deflateRawSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { readCabinet } from '../../src/index';
import { writeCabinet } from '../helpers/cab-writer';
import { catchRejection } from '../helpers/catch-error';

// R1.1–R1.5 on synthetic cabinets.

const text = (s: string) => new TextEncoder().encode(s);
const lorem = (seed: string, n: number) =>
  text(Array.from({ length: n }, (_, i) => `${seed}${i % 97} `).join(''));

describe('readCabinet', () => {
  test('returns name, size, date, time, attributes, folder and bytes (R1.1)', async () => {
    const files = [
      { name: 'manifest.xsf', bytes: text('<m/>'), date: 0x4d21, time: 0x7bcf, attributes: 0x21 },
      { name: 'view1.xsl', bytes: text('<v/>'), attributes: 0xa0 },
    ];
    const cab = await readCabinet(writeCabinet(files).bytes);
    expect(cab.issues).toEqual([]);
    expect(cab.files).toEqual([
      {
        name: 'manifest.xsf',
        size: 4,
        date: 0x4d21,
        time: 0x7bcf,
        attributes: 0x21,
        folder: 0,
        bytes: text('<m/>'),
      },
      {
        name: 'view1.xsl',
        size: 4,
        date: 0x5b6a,
        time: 0x6000,
        attributes: 0xa0,
        folder: 0,
        bytes: text('<v/>'),
      },
    ]);
    expect(cab.info).toEqual({
      versionMajor: 1,
      versionMinor: 3,
      flags: 0,
      setId: 0x1234,
      cabinetIndex: 0,
      folders: [{ compression: 'mszip', blocks: 1, offset: expect.any(Number) as number }],
    });
  });

  test('two multi-block folders, history carried within each (R1.2)', async () => {
    const a = lorem('alpha', 9_000);
    const b = lorem('beta', 7_000);
    const { bytes } = writeCabinet(
      [
        { name: 'a.xml', bytes: a },
        { name: 'b.xml', bytes: b, folder: 1 },
      ],
      { blockSize: 4096 },
    );
    const cab = await readCabinet(bytes);
    expect(cab.info.folders.map((f) => f.blocks)).toEqual([
      Math.ceil(a.length / 4096),
      Math.ceil(b.length / 4096),
    ]);
    expect(cab.files.map((f) => f.bytes)).toEqual([a, b]);
  });

  test('history starts fresh in each folder (R1.2)', async () => {
    // Folder 1's only block is compressed against folder 0's output. That is not a valid
    // cabinet: with fresh history its back-references reach before the start.
    const a = lorem('shared', 3_000);
    const b = lorem('shared', 500);
    const sneaky = new Uint8Array([
      0x43,
      0x4b,
      ...deflateRawSync(b, { dictionary: a.subarray(a.length - 32_768) }),
    ]);
    const { bytes, layout } = writeCabinet(
      [
        { name: 'a.xml', bytes: a },
        { name: 'b.xml', bytes: b, folder: 1 },
      ],
      { blockFields: { '1:0': { ab: sneaky } } },
    );
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: layout.blocks[1]![0] },
    });
  });

  test('a type-0 folder is copied as is (R1.3)', async () => {
    const data = lorem('stored', 4_000);
    const cab = await readCabinet(
      writeCabinet([{ name: 'raw.bin', bytes: data }], {
        folders: [{ compression: 'none' }],
        blockSize: 10_000,
      }).bytes,
    );
    expect(cab.info.folders).toEqual([
      {
        compression: 'none',
        blocks: Math.ceil(data.length / 10_000),
        offset: expect.any(Number) as number,
      },
    ]);
    expect(cab.files[0]!.bytes).toEqual(data);
  });

  test('a stored and an MSZIP folder in one cabinet', async () => {
    const cab = await readCabinet(
      writeCabinet(
        [
          { name: 'x', bytes: text('stored bytes'), folder: 0 },
          { name: 'y', bytes: text('deflated bytes'), folder: 1 },
        ],
        { folders: [{ compression: 'none' }, { compression: 'mszip' }] },
      ).bytes,
    );
    expect(cab.files.map((f) => [f.name, f.folder, new TextDecoder().decode(f.bytes)])).toEqual([
      ['x', 0, 'stored bytes'],
      ['y', 1, 'deflated bytes'],
    ]);
  });

  test('names: UTF-8 with attribute 0x80, Windows-1252 without (R1.4)', async () => {
    const cab = await readCabinet(
      writeCabinet([
        { name: 'Ünïcødé-表单.xml', bytes: text('1'), attributes: 0xa0 },
        {
          name: 'ignored',
          nameBytes: new Uint8Array([0x80, 0x20, 0xe9, 0x9f, 0x2e, 0x78]),
          bytes: text('2'),
        },
      ]).bytes,
    );
    expect(cab.files.map((f) => f.name)).toEqual(['Ünïcødé-表单.xml', '€ éŸ.x']);
  });

  test('files come back in CFFILE order, not by name or folder (R1.5)', async () => {
    const names = ['zeta.xsl', 'alpha.xsd', 'manifest.xsf', 'Beta.xml'];
    const cab = await readCabinet(
      writeCabinet(names.map((name, i) => ({ name, bytes: text(name), folder: i % 2 }))).bytes,
    );
    expect(cab.files.map((f) => f.name)).toEqual(names);
    expect(cab.files.map((f) => new TextDecoder().decode(f.bytes))).toEqual(names);
  });

  test('a reserve header (flag 0x0004) reads normally (R2.4)', async () => {
    const data = lorem('reserve', 5_000);
    const cab = await readCabinet(
      writeCabinet([{ name: 'r.xml', bytes: data }], {
        blockSize: 8192,
        reserve: { header: 9, folder: 5, data: 3 },
      }).bytes,
    );
    expect(cab.info.flags).toBe(4);
    expect(cab.issues).toEqual([]);
    expect(cab.files[0]!.bytes).toEqual(data);
  });

  test('zero checksums are not checked', async () => {
    const cab = await readCabinet(
      writeCabinet([{ name: 'a', bytes: text('a') }], { checksums: 'zero' }).bytes,
    );
    expect(cab.issues).toEqual([]);
  });

  test('an empty file and an empty cabinet', async () => {
    const cab = await readCabinet(
      writeCabinet([{ name: 'empty.txt', bytes: new Uint8Array(0) }]).bytes,
    );
    expect(cab.files).toEqual([expect.objectContaining({ name: 'empty.txt', size: 0 })]);
    expect((await readCabinet(writeCabinet([]).bytes)).files).toEqual([]);
  });

  test('every folder is checked for compression before any is inflated (R2.1)', async () => {
    const { bytes } = writeCabinet([{ name: 'a', bytes: text('a') }], {
      folders: [{}, { compression: 3 }],
      blockFields: { '0:0': { ab: new Uint8Array([0x43, 0x4b, 0xff, 0xff]) } },
    });
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'UNSUPPORTED_COMPRESSION',
      details: { method: 'LZX', folder: 1 },
    });
  });
});
