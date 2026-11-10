import { deflateRawSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { inflateBlock, storedBlock } from '../../src/cab/inflate';
import { AfterlifeError } from '../../src/errors';
import { walkCfData } from '../helpers/cfdata';
import { sampleCabinets, readSample } from '../helpers/samples';
import { zlibOracleFolder } from '../helpers/zlib-oracle';

// Task 2 spike (design D1–D3, R1.2, R17.2): the stored-block prefix gives the same folder bytes
// as zlib with a preset dictionary, on every in-repo cabinet.

const cabinets = sampleCabinets();

async function inflateFolder(cab: Uint8Array): Promise<{ bytes: Uint8Array; blocks: number }> {
  const { blocks } = walkCfData(cab);
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.cbUncomp, 0));
  let at = 0;
  for (const block of blocks) {
    const history = out.subarray(Math.max(0, at - 32_768), at);
    out.set(await inflateBlock(block.data, history, block.cbUncomp), at);
    at += block.cbUncomp;
  }
  return { bytes: out, blocks: blocks.length };
}

describe('stored-block prefix on every sample cabinet', () => {
  test('there are 48 cabinets: 47 own and the public sample', () => {
    expect(cabinets).toHaveLength(48);
  });

  test.each(cabinets.map((c) => [c.slug, c.path]))(
    '%s equals the zlib oracle',
    async (_s, path) => {
      const cab = readSample(path);
      const { bytes } = await inflateFolder(cab);
      expect(bytes).toEqual(zlibOracleFolder(cab));
    },
  );

  test('exactly 7 cabinets have more than one block, so the history path runs', () => {
    const multi = cabinets.filter((c) => walkCfData(readSample(c.path)).blocks.length > 1);
    expect(multi.map((c) => c.slug)).toHaveLength(7);
  });
});

describe('storedBlock', () => {
  test('header is 0x00, LEN, ~LEN little-endian', () => {
    const block = storedBlock(new Uint8Array(0x1234).fill(7));
    expect([...block.subarray(0, 5)]).toEqual([0x00, 0x34, 0x12, 0xcb, 0xed]);
    expect(block.length).toBe(5 + 0x1234);
  });

  test('keeps only the last 32,768 bytes', () => {
    const history = new Uint8Array(40_000).map((_, i) => i & 0xff);
    const block = storedBlock(history);
    expect(block.length).toBe(5 + 32_768);
    expect(block.subarray(5)).toEqual(history.subarray(40_000 - 32_768));
  });
});

describe('acceptance by byte count (D3)', () => {
  const text = new TextEncoder().encode('Afterlife '.repeat(500));
  const stream = deflateRawSync(text);

  test('a whole stream inflates to its length', async () => {
    expect(await inflateBlock(stream, new Uint8Array(0), text.length)).toEqual(text);
  });

  test('8 junk bytes after the stream are accepted', async () => {
    const junk = new Uint8Array([...stream, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await inflateBlock(junk, new Uint8Array(0), text.length)).toEqual(text);
  });

  test('output one byte short of cbUncomp is CORRUPT_CAB', async () => {
    await expect(inflateBlock(stream, new Uint8Array(0), text.length + 1)).rejects.toMatchObject({
      code: 'CORRUPT_CAB',
    });
  });

  test('a stream cut in half is CORRUPT_CAB', async () => {
    const cut = stream.subarray(0, stream.length >> 1);
    await expect(inflateBlock(cut, new Uint8Array(0), text.length)).rejects.toMatchObject({
      code: 'CORRUPT_CAB',
    });
  });

  test('more output than expected is CORRUPT_CAB', async () => {
    const err: unknown = await inflateBlock(stream, new Uint8Array(0), text.length - 1).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AfterlifeError);
    expect(err).toMatchObject({ code: 'CORRUPT_CAB' });
  });

  test('garbage is CORRUPT_CAB', async () => {
    const garbage = new Uint8Array(64).fill(0xff);
    await expect(inflateBlock(garbage, new Uint8Array(0), 100)).rejects.toMatchObject({
      code: 'CORRUPT_CAB',
    });
  });

  test('a block that refers back into the history decodes after the prefix', async () => {
    const history = new TextEncoder().encode('the quick brown fox jumps over the lazy dog. ');
    const next = new TextEncoder().encode('the quick brown fox jumps again. ');
    const block = deflateRawSync(next, { dictionary: history });
    expect(await inflateBlock(block, history, next.length)).toEqual(next);
  });
});
