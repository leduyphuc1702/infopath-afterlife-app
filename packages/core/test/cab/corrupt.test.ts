import { describe, expect, test } from 'vitest';
import { readCabinet } from '../../src/index';
import { catchRejection } from '../helpers/catch-error';
import { walkCfData } from '../helpers/cfdata';
import { readSample, sampleCabinets } from '../helpers/samples';

// R3.2–R3.6 on one real cabinet: 02-expense-report (two CFDATA blocks, so a truncation can land
// after a block that already inflated).

const sample = sampleCabinets().find((c) => c.slug === '02-expense-report')!;
const original = readSample(sample.path);
const view = new DataView(original.buffer, original.byteOffset, original.byteLength);
const blocks = walkCfData(original).blocks;
const coffFiles = view.getUint32(16, true);
const cFiles = view.getUint16(28, true);

/** Offset of each CFFILE entry, walked with plain arithmetic (independent of src/). */
const fileEntries: number[] = [];
for (let i = 0, p = coffFiles; i < cFiles; i++) {
  fileEntries.push(p);
  p = original.indexOf(0, p + 16) + 1;
}

/**
 * Start offset of every field the reader reads, with its length. Truncating inside a field must
 * report that field's start: the offset where the read was attempted (R3.2).
 */
const fields: [start: number, length: number, what: string][] = [
  [0, 4, 'signature'],
  ...[4, 8, 12, 16, 20].map((o): [number, number, string] => [o, 4, `header u32 @${o}`]),
  [24, 1, 'versionMinor'],
  [25, 1, 'versionMajor'],
  ...[26, 28, 30, 32, 34].map((o): [number, number, string] => [o, 2, `header u16 @${o}`]),
  [36, 4, 'CFFOLDER.coffCabStart'],
  [40, 2, 'CFFOLDER.cCFData'],
  [42, 2, 'CFFOLDER.typeCompress'],
  ...fileEntries.flatMap((f, i): [number, number, string][] => [
    [f, 4, `CFFILE[${i}].cbFile`],
    [f + 4, 4, `CFFILE[${i}].uoffFolderStart`],
    ...[8, 10, 12, 14].map((d): [number, number, string] => [f + d, 2, `CFFILE[${i}] u16 +${d}`]),
    [f + 16, original.indexOf(0, f + 16) - (f + 16) + 1, `CFFILE[${i}].szName`],
  ]),
  ...blocks.flatMap((b, i): [number, number, string][] => [
    [b.offset, 4, `CFDATA[${i}].csum`],
    [b.offset + 4, 2, `CFDATA[${i}].cbData`],
    [b.offset + 6, 2, `CFDATA[${i}].cbUncomp`],
    [b.offset + 8, b.cbData, `CFDATA[${i}].ab`],
  ]),
];

function copy(): { bytes: Uint8Array; view: DataView } {
  const bytes = original.slice();
  return { bytes, view: new DataView(bytes.buffer) };
}

describe(`truncation of ${sample.slug} at every structure boundary (R3.2)`, () => {
  test('the sample has the layout this test expects', () => {
    expect(blocks).toHaveLength(2);
    expect(view.getUint16(26, true)).toBe(1);
    expect(blocks[1]!.offset + 8 + blocks[1]!.cbData).toBe(original.length);
  });

  const cases = fields.flatMap(([start, length, what]) => {
    const cuts = new Set([start, start + 1, start + length - 1].filter((c) => c < start + length));
    return [...cuts].map((cut) => [cut, start, what] as const);
  });

  test.each(cases)('cut at %i → CORRUPT_CAB at %i (%s)', async (cut, start) => {
    const err = await catchRejection(readCabinet(original.subarray(0, cut)));
    expect(err.code).toBe('CORRUPT_CAB');
    expect((err.details as { offset: number }).offset).toBe(start);
  });

  test('the whole cabinet still reads', async () => {
    expect((await readCabinet(original)).files).toHaveLength(cFiles);
  });
});

describe('damaged blocks (R3.3)', () => {
  test('a block without CK is CORRUPT_CAB at the block', async () => {
    for (const b of blocks) {
      const { bytes } = copy();
      bytes[b.offset + 8] = 0x00;
      expect(await catchRejection(readCabinet(bytes))).toMatchObject({
        code: 'CORRUPT_CAB',
        details: { offset: b.offset, reason: 'MSZIP block has no CK signature' },
      });
    }
  });

  test.each([-1, 1])('cbUncomp changed by %i is CORRUPT_CAB at the block', async (delta) => {
    for (const b of blocks) {
      const { bytes, view: v } = copy();
      v.setUint16(b.offset + 6, b.cbUncomp + delta, true);
      expect(await catchRejection(readCabinet(bytes))).toMatchObject({
        code: 'CORRUPT_CAB',
        details: { offset: b.offset },
      });
    }
  });

  test('deflate data that does not inflate is CORRUPT_CAB at the block', async () => {
    const { bytes } = copy();
    bytes.fill(0xff, blocks[0]!.offset + 10, blocks[0]!.offset + 40);
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: blocks[0]!.offset },
    });
  });
});

describe('file entries (R3.5)', () => {
  test('a folder index that does not exist is CORRUPT_CAB at the CFFILE entry', async () => {
    const { bytes, view: v } = copy();
    v.setUint16(fileEntries[2]! + 8, 1, true);
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: fileEntries[2] },
    });
  });

  test('a file range past the folder end is CORRUPT_CAB at the CFFILE entry', async () => {
    const last = fileEntries.reduce((a, b) =>
      view.getUint32(a + 4, true) > view.getUint32(b + 4, true) ? a : b,
    );
    for (const [field, delta] of [
      [0, 1],
      [4, 1],
      [4, 0x7fff_0000],
    ] as const) {
      const { bytes, view: v } = copy();
      v.setUint32(last + field, v.getUint32(last + field, true) + delta, true);
      expect(await catchRejection(readCabinet(bytes))).toMatchObject({
        code: 'CORRUPT_CAB',
        details: { offset: last },
      });
    }
  });
});

describe('checksum mismatch (R3.4, R3.6)', () => {
  test('one flipped checksum byte: same files, exactly one CHECKSUM_MISMATCH', async () => {
    const good = await readCabinet(original);
    expect(good.issues).toEqual([]);
    const { bytes } = copy();
    const b = blocks[1]!;
    bytes[b.offset + 2]! ^= 0x5a;
    const stored = new DataView(bytes.buffer).getUint32(b.offset, true);

    const damaged = await readCabinet(bytes);
    expect(damaged.files).toEqual(good.files);
    expect(damaged.issues).toEqual([
      {
        code: 'CHECKSUM_MISMATCH',
        message: expect.stringContaining(`offset ${b.offset}`) as string,
        offset: b.offset,
        details: { stored, computed: b.csum },
      },
    ]);
  });

  test('a wrong checksum does not rescue a block that fails to inflate', async () => {
    const { bytes, view: v } = copy();
    v.setUint32(blocks[0]!.offset, 0x1234_5678, true);
    v.setUint16(blocks[0]!.offset + 6, blocks[0]!.cbUncomp - 1, true);
    expect((await catchRejection(readCabinet(bytes))).code).toBe('CORRUPT_CAB');
  });
});
