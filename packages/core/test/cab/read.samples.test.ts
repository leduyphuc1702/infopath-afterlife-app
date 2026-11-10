import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readCabinet } from '../../src/index';
import { repoRoot, readSample, sampleCabinets } from '../helpers/samples';
import { sha256Hex } from '../helpers/zlib-oracle';
import { PUBLIC_SAMPLE_FILES } from '../oracles/public-sample';

// R1.6: every in-repo cabinet against its unpacked copy (forms/<slug>/, which equals bsdtar
// output), and the public sample against requirements Appendix B. No bsdtar at test time.

const cabinets = sampleCabinets();
const own = cabinets.filter((c) => c.slug !== 'theill-weight-keeper');
const formsRoot = `${repoRoot}samples/own/forms/`;

describe('samples/own: xsn and forms folders pair up', () => {
  test('every .xsn has a forms/ folder', () => {
    expect(own.filter((c) => c.formsDir === undefined).map((c) => c.slug)).toEqual([]);
  });

  test('every forms/ folder has an .xsn', () => {
    const slugs = new Set(own.map((c) => c.slug));
    const folders = readdirSync(formsRoot).filter((n) =>
      statSync(`${formsRoot}${n}`).isDirectory(),
    );
    expect(folders.filter((n) => !slugs.has(n))).toEqual([]);
    expect(folders.length).toBe(own.length);
  });
});

describe('samples/own: readCabinet equals forms/<slug>/ byte for byte', () => {
  test.each(own.map((c) => [c.slug, c] as const))('%s', async (_slug, cab) => {
    const result = await readCabinet(readSample(cab.path));
    expect(result.issues).toEqual([]);
    const dir = cab.formsDir!;
    const expected = readdirSync(dir).sort();
    expect(result.files.map((f) => f.name).sort()).toEqual(expected);
    for (const f of result.files) {
      const want = new Uint8Array(readFileSync(`${dir}${f.name}`));
      expect(f.size, f.name).toBe(want.length);
      expect(f.bytes, f.name).toEqual(want);
    }
  });
});

describe('samples/public: theill-weight-keeper equals Appendix B', () => {
  test('six files with the listed sizes and SHA-256', async () => {
    const pub = cabinets.find((c) => c.slug === 'theill-weight-keeper')!;
    const result = await readCabinet(readSample(pub.path));
    expect(result.issues).toEqual([]);
    const got = Object.fromEntries(
      result.files.map((f) => [f.name, { size: f.bytes.length, sha256: sha256Hex(f.bytes) }]),
    );
    expect(got).toEqual(PUBLIC_SAMPLE_FILES);
  });
});
