import { deflateRawSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { readStructures } from '../src/cab/structures';
import { DEFAULT_LIMITS, resolveLimits, type Limits } from '../src/limits';
import { parseXml, xmlContext } from '../src/xml/parse';
import { readCabinet } from '../src/index';
import { writeCabinet } from './helpers/cab-writer';
import { catchError, catchRejection } from './helpers/catch-error';

const MiB = 1024 * 1024;

describe('defaults and overrides (R4.6)', () => {
  test('defaults are 20 MiB, 50 MiB, 2,000 entries, 4,096 blocks, depth 256 and 4 MiB', () => {
    expect(DEFAULT_LIMITS).toEqual({
      inputBytes: 20 * MiB,
      uncompressedBytes: 50 * MiB,
      entries: 2_000,
      blocks: 4_096,
      xmlDepth: 256,
      xmlBytes: 4 * MiB,
    });
    expect(Object.isFrozen(DEFAULT_LIMITS)).toBe(true);
  });

  test('no overrides gives the defaults', () => {
    expect(resolveLimits()).toEqual(DEFAULT_LIMITS);
    expect(resolveLimits({})).toEqual(DEFAULT_LIMITS);
  });

  test('a partial override changes only that limit', () => {
    expect(resolveLimits({ entries: 10 })).toEqual({ ...DEFAULT_LIMITS, entries: 10 });
    expect(resolveLimits({ xmlDepth: 8, inputBytes: 100 })).toEqual({
      ...DEFAULT_LIMITS,
      xmlDepth: 8,
      inputBytes: 100,
    });
  });

  test('an explicit undefined (from plain JavaScript callers) keeps the default', () => {
    expect(resolveLimits({ entries: undefined } as unknown as Partial<Limits>)).toEqual(
      DEFAULT_LIMITS,
    );
  });

  test('unknown keys are ignored', () => {
    expect(resolveLimits({ nope: 1 } as never)).toEqual(DEFAULT_LIMITS);
  });
});

describe('cabinet structure limits (R4.2, R4.3)', () => {
  const one = (i: number) => ({ name: `f${i}`, bytes: new Uint8Array([i & 0xff]) });

  test('2,000 declared files pass; 2,001 give LIMIT_EXCEEDED entries', () => {
    const ok = writeCabinet(Array.from({ length: 2_000 }, (_, i) => one(i))).bytes;
    expect(readStructures(ok, DEFAULT_LIMITS).files).toHaveLength(2_000);
    const over = writeCabinet(Array.from({ length: 2_001 }, (_, i) => one(i))).bytes;
    expect(() => readStructures(over, DEFAULT_LIMITS)).toThrow(
      expect.objectContaining({
        code: 'LIMIT_EXCEEDED',
        details: { limit: 'entries', max: 2_000, observed: 2_001 },
      }),
    );
  });

  test('the entries limit applies before any CFFILE entry is read', () => {
    // 2,001 declared but only one written: reading the entries would be CORRUPT_CAB.
    const { bytes } = writeCabinet([one(0)], { header: { cFiles: 2_001 } });
    expect(() => readStructures(bytes, DEFAULT_LIMITS)).toThrow(
      expect.objectContaining({ code: 'LIMIT_EXCEEDED' }),
    );
    expect(() => readStructures(bytes, resolveLimits({ entries: 5_000 }))).toThrow(
      expect.objectContaining({ code: 'CORRUPT_CAB' }),
    );
  });

  test('20 MiB passes the input check; 20 MiB + 1 byte gives LIMIT_EXCEEDED inputBytes first', () => {
    const exact = new Uint8Array(20 * MiB);
    expect(() => readStructures(exact, DEFAULT_LIMITS)).toThrow(
      expect.objectContaining({ code: 'CORRUPT_CAB' }),
    );
    const over = new Uint8Array(20 * MiB + 1);
    expect(() => readStructures(over, DEFAULT_LIMITS)).toThrow(
      expect.objectContaining({
        code: 'LIMIT_EXCEEDED',
        details: { limit: 'inputBytes', max: 20 * MiB, observed: 20 * MiB + 1 },
      }),
    );
  });

  test('limits are options', () => {
    const { bytes } = writeCabinet([one(0), one(1), one(2)]);
    expect(() => readStructures(bytes, resolveLimits({ entries: 2 }))).toThrow(
      expect.objectContaining({ details: { limit: 'entries', max: 2, observed: 3 } }),
    );
    expect(() => readStructures(bytes, resolveLimits({ inputBytes: 10 }))).toThrow(
      expect.objectContaining({
        details: { limit: 'inputBytes', max: 10, observed: bytes.length },
      }),
    );
  });
});

describe('uncompressed size and block limits (R4.1, R4.4)', () => {
  const ck = (bytes: Uint8Array) => new Uint8Array([0x43, 0x4b, ...bytes]);
  const zeros32k = ck(deflateRawSync(new Uint8Array(32_768)));
  const garbage = new Uint8Array([0x43, 0x4b, 0xff, 0xff, 0xff, 0xff]);

  test('a declared 51 MiB stops before any block is inflated', async () => {
    const { bytes } = writeCabinet([{ name: 'big.xml', bytes: new Uint8Array(10) }], {
      fileFields: { 0: { cbFile: 51 * MiB } },
      blockFields: { '0:0': { ab: garbage } },
    });
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'uncompressedBytes', max: 50 * MiB, observed: 51 * MiB },
    });
  });

  test('actual output past 50 MiB stops before the block that would pass it', async () => {
    // 1,600 blocks of 32 KiB are exactly 50 MiB. Block 1,601 is garbage: had the reader inflated
    // it, the error would be CORRUPT_CAB.
    const blocks = Array.from({ length: 1_600 }, () => ({ ab: zeros32k, cbUncomp: 32_768 }));
    blocks.push({ ab: garbage, cbUncomp: 32_768 });
    const { bytes } = writeCabinet([{ name: 'tiny.xml', bytes: new Uint8Array(1) }], {
      folders: [{ blocks }],
    });
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'uncompressedBytes', max: 50 * MiB, observed: 50 * MiB + 32_768 },
    });
  });

  test('exactly 50 MiB of output is accepted', async () => {
    const blocks = Array.from({ length: 1_600 }, () => ({ ab: zeros32k, cbUncomp: 32_768 }));
    const { bytes } = writeCabinet([{ name: 'tiny.xml', bytes: new Uint8Array(1) }], {
      folders: [{ blocks }],
    });
    const cab = await readCabinet(bytes);
    expect(cab.files[0]!.bytes).toEqual(new Uint8Array(1));
  });

  test('the budget is shared by all folders, and is an option', async () => {
    const data = new Uint8Array(60_000).map((_, i) => i % 251);
    const { bytes } = writeCabinet([
      { name: 'a', bytes: data },
      { name: 'b', bytes: data, folder: 1 },
    ]);
    await expect(
      readCabinet(bytes, { limits: { uncompressedBytes: 120_000 } }),
    ).resolves.toBeDefined();
    expect(
      await catchRejection(readCabinet(bytes, { limits: { uncompressedBytes: 119_999 } })),
    ).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'uncompressedBytes', max: 119_999 },
    });
  });

  test('cbUncomp 32,768 is accepted; 32,769 is CORRUPT_CAB', async () => {
    const ok = writeCabinet([{ name: 'a', bytes: new Uint8Array(1) }], {
      folders: [{ blocks: [{ ab: zeros32k, cbUncomp: 32_768 }] }],
    });
    await expect(readCabinet(ok.bytes)).resolves.toBeDefined();
    const big = ck(deflateRawSync(new Uint8Array(32_769)));
    const { bytes, layout } = writeCabinet([{ name: 'a', bytes: new Uint8Array(1) }], {
      folders: [{ blocks: [{ ab: big, cbUncomp: 32_769 }] }],
    });
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: layout.blocks[0]![0] },
    });
  });
});

describe('xmlBytes across documents (D7, R4.6)', () => {
  const doc = (n: number) => new TextEncoder().encode(`<r>${'x'.repeat(n - 7)}</r>`);

  test('the budget is shared by every document parsed with one context', () => {
    const ctx = xmlContext(resolveLimits({ xmlBytes: 1_000 }));
    parseXml(doc(600), 'manifest.xsf', ctx);
    expect(ctx.xmlBytesUsed).toBe(600);
    expect(catchError(() => parseXml(doc(401), 'schema.xsd', ctx))).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'xmlBytes', max: 1_000, observed: 1_001, file: 'schema.xsd' },
    });
    // The refused document is not charged; one that fits still parses.
    expect(ctx.xmlBytesUsed).toBe(600);
    parseXml(doc(400), 'view1.xsl', ctx);
    expect(ctx.xmlBytesUsed).toBe(1_000);
  });

  test('the default is 4 MiB', () => {
    const ctx = xmlContext(DEFAULT_LIMITS);
    parseXml(doc(4 * MiB), 'a.xml', ctx);
    expect(catchError(() => parseXml(doc(8), 'b.xml', ctx)).details).toMatchObject({
      limit: 'xmlBytes',
      max: 4 * MiB,
      observed: 4 * MiB + 8,
    });
  });
});
