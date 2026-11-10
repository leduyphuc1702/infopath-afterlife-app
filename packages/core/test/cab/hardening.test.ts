import { deflateRawSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { readCabinet } from '../../src/index';
import { writeCabinet, type WriterOptions } from '../helpers/cab-writer';
import { catchRejection } from '../helpers/catch-error';

// R3.7, R3.8, R4.7 (added 2026-11-10 after the task 5 review): folders may not share bytes with
// each other or with the CFFILE area, the declared block count is capped, and no block may
// declare zero bytes. Together they stop a small cabinet from multiplying the work (P1, R19).

const MiB = 1024 * 1024;
const text = (s: string) => new TextEncoder().encode(s);
const data = (seed: number, n: number) =>
  Uint8Array.from({ length: n }, (_, i) => (i * seed) % 251);

/** Writes once to learn the layout, then again with overrides computed from it. */
function rewrite(
  files: Parameters<typeof writeCabinet>[0],
  options: WriterOptions,
  extra: (layout: ReturnType<typeof writeCabinet>['layout']) => WriterOptions,
) {
  const first = writeCabinet(files, options);
  const second = writeCabinet(files, { ...options, ...extra(first.layout) });
  expect(second.layout).toEqual(first.layout);
  return second;
}

const twoFolders = [
  { name: 'a.xml', bytes: data(7, 5_000) },
  { name: 'b.xml', bytes: data(13, 3_000), folder: 1 },
];

describe('overlapping folders (R3.7)', () => {
  test('a folder starting inside another folder: CORRUPT_CAB with both offsets', async () => {
    const { bytes, layout } = rewrite(twoFolders, { blockSize: 2_048 }, (l) => ({
      folderFields: { 1: { coffCabStart: l.blocks[0]![1]!, cCFData: 1 } },
    }));
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: {
        offset: layout.blocks[0]![1],
        otherOffset: layout.blocks[0]![0],
        reason: expect.stringMatching(/folder 1 .* overlaps .* folder 0/) as string,
      },
    });
  });

  test('two folders on the same bytes', async () => {
    const { bytes, layout } = rewrite(twoFolders, { blockSize: 2_048 }, (l) => ({
      folderFields: { 1: { coffCabStart: l.blocks[0]![0]!, cCFData: 3 } },
    }));
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: layout.blocks[0]![0], otherOffset: layout.blocks[0]![0] },
    });
  });

  test('a folder whose last block runs into the next folder', async () => {
    // Folder 0 declares one block more than it has, so its walk reads folder 1's first block.
    const { bytes, layout } = rewrite(twoFolders, { blockSize: 2_048 }, (l) => ({
      folderFields: { 0: { cCFData: l.blocks[0]!.length + 1 } },
    }));
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: layout.blocks[1]![0], otherOffset: layout.blocks[0]![0] },
    });
  });

  test('a folder overlapping the CFFILE area', async () => {
    const files = [
      { name: 'manifest.xsf', bytes: data(3, 100) },
      { name: 'view1.xsl', bytes: data(5, 100) },
    ];
    // Read as CFDATA, the second CFFILE entry gives cbData = 100 (its uoffFolderStart) and
    // cbUncomp = 0; the overlap is reported before any per-block check.
    const { bytes, layout } = rewrite(files, {}, (l) => ({
      folderFields: { 0: { coffCabStart: l.files[1]!, cCFData: 1 } },
    }));
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: {
        offset: layout.files[1],
        otherOffset: layout.files[0],
        reason: expect.stringContaining('the CFFILE area') as string,
      },
    });
  });

  test('folders with no blocks overlap nothing', async () => {
    const cab = await readCabinet(
      writeCabinet([{ name: 'a', bytes: text('a') }], { folders: [{}, {}, {}] }).bytes,
    );
    expect(cab.info.folders.map((f) => f.blocks)).toEqual([1, 0, 0]);
  });
});

describe('block count (R4.7)', () => {
  const one = [{ name: 'a', bytes: text('a') }];

  test('4,097 declared blocks: LIMIT_EXCEEDED before any block header is read', async () => {
    // Only one block exists; had the reader walked the headers it would fail with CORRUPT_CAB.
    const { bytes } = writeCabinet(one, { folderFields: { 0: { cCFData: 4_097 } } });
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'blocks', max: 4_096, observed: 4_097 },
    });
  });

  test('the count is the total across folders', async () => {
    const { bytes } = writeCabinet(one, {
      folders: [{}, {}],
      folderFields: { 0: { cCFData: 2_048 }, 1: { cCFData: 2_049 } },
    });
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      details: { limit: 'blocks', observed: 4_097 },
    });
  });

  test('4,096 declared blocks pass the count (and then fail on the missing blocks)', async () => {
    const { bytes } = writeCabinet(one, { folderFields: { 0: { cCFData: 4_096 } } });
    expect((await catchRejection(readCabinet(bytes))).code).toBe('CORRUPT_CAB');
  });

  test('the limit is an option', async () => {
    const { bytes } = writeCabinet([{ name: 'a', bytes: data(3, 10_000) }], { blockSize: 1_000 });
    await expect(readCabinet(bytes, { limits: { blocks: 10 } })).resolves.toBeDefined();
    expect(await catchRejection(readCabinet(bytes, { limits: { blocks: 9 } }))).toMatchObject({
      details: { limit: 'blocks', max: 9, observed: 10 },
    });
  });
});

describe('zero-length blocks (R3.8)', () => {
  test.each(['mszip', 'none'] as const)('a %s block with cbUncomp 0 is CORRUPT_CAB', async (c) => {
    const { bytes, layout } = writeCabinet([{ name: 'a', bytes: data(3, 3_000) }], {
      folders: [{ compression: c }],
      blockSize: 1_000,
      blockFields: { '0:1': { cbUncomp: 0, ...(c === 'none' ? { ab: new Uint8Array(0) } : {}) } },
    });
    expect(await catchRejection(readCabinet(bytes))).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { offset: layout.blocks[0]![1], reason: 'block declares 0 uncompressed bytes' },
    });
  });
});

describe('crafted 2 MiB cabinets fail fast (P1)', () => {
  // One run of tiny MSZIP blocks (1 byte each) filling about 2 MiB. Before R3.7 and R4.7, every
  // folder below could point at the same run and declare 65,535 blocks, so each byte of input
  // was inflated many times over without passing any other limit.
  const tiny = new Uint8Array([0x43, 0x4b, ...deflateRawSync(new Uint8Array(1))]);
  const perBlock = 8 + tiny.length;
  const runLength = Math.floor((2 * MiB - 4_096) / perBlock);
  const run = Array.from({ length: runLength }, () => ({ ab: tiny, cbUncomp: 1 }));

  function crafted(folders: number, blocksPerFolder: number): Uint8Array {
    const files = [{ name: 'a', bytes: new Uint8Array(1) }];
    const options: WriterOptions = {
      folders: [{ blocks: run }, ...Array.from({ length: folders - 1 }, () => ({}))],
    };
    const { bytes } = rewrite(files, options, (l) => ({
      folderFields: Object.fromEntries(
        Array.from({ length: folders }, (_, i) => [
          i,
          { coffCabStart: l.blocks[0]![0]!, cCFData: blocksPerFolder },
        ]),
      ),
    }));
    expect(bytes.length).toBeLessThanOrEqual(2 * MiB);
    expect(bytes.length).toBeGreaterThan(2 * MiB - 64 * 1024);
    return bytes;
  }

  async function timed(bytes: Uint8Array) {
    const start = performance.now();
    const err = await catchRejection(readCabinet(bytes));
    return { err, ms: performance.now() - start };
  }

  test('32 folders × 65,535 blocks on the same bytes: LIMIT_EXCEEDED blocks in < 100 ms', async () => {
    const bytes = crafted(32, 65_535);
    await timed(bytes); // warm-up
    const { err, ms } = await timed(bytes);
    expect(err).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'blocks', observed: 32 * 65_535 },
    });
    expect(ms).toBeLessThan(100);
  });

  test('4 folders × 1,024 blocks on the same bytes (within the count): CORRUPT_CAB in < 100 ms', async () => {
    const bytes = crafted(4, 1_024);
    await timed(bytes);
    const { err, ms } = await timed(bytes);
    expect(err).toMatchObject({
      code: 'CORRUPT_CAB',
      details: { otherOffset: expect.any(Number) as number },
    });
    expect(err.details).toMatchObject({ reason: expect.stringContaining('overlaps') as string });
    expect(ms).toBeLessThan(100);
  });
});
