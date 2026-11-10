import { homedir, tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { parseXsn } from '../src/index';
import { readmeTable } from './oracles/readme-table';
import { readSample, repoRoot, sampleCabinets } from './helpers/samples';
import { goldenText, snapshot, type Snapshot } from './helpers/snapshot';

// R16.4: the full parser output of every README form and the public sample, as a golden file
// (test/golden/<slug>.json, bytes as { size, sha256 }). It is also the whole-result check for the
// oracles of R7.6, R8.5, R9.6, R10.5, R11.7 and R12.6, and R17.4: the network is stubbed to throw
// and must never be touched. A changed golden file is a reviewed diff (`vitest -u`).
// Every test stands alone, so the file passes with `--sequence.shuffle`.

const cabinets = sampleCabinets();
const network = {
  fetch: vi.fn(() => {
    throw new Error('R17.4: core made a network request (fetch)');
  }),
  XMLHttpRequest: vi.fn(function () {
    throw new Error('R17.4: core made a network request (XMLHttpRequest)');
  }),
};

beforeAll(() => {
  vi.stubGlobal('fetch', network.fetch);
  vi.stubGlobal('XMLHttpRequest', network.XMLHttpRequest);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

test('the cabinets are the README forms and the public sample', () => {
  expect(cabinets.map((c) => c.slug)).toEqual([
    ...readmeTable()
      .map((r) => r.slug)
      .sort(),
    'theill-weight-keeper',
  ]);
  expect(cabinets).toHaveLength(48);
});

test('the machine-path check finds what it looks for', () => {
  expect(
    machinePaths({ a: `${repoRoot}samples/x.xsn`, b: ['/home/ci/x'], 'file:///x': null }),
  ).toEqual([`${repoRoot}samples/x.xsn`, '/home/ci/x', 'file:///x']);
  expect(
    machinePaths({ projectPath: 'C:\\Users\\formdev\\x', path: '/xsf:xDocumentClass[1]' }),
  ).toEqual([]);
});

test.each(cabinets.map((c) => [c.slug, c.path]))(
  '%s matches its golden file',
  async (slug, path) => {
    const result = await parseXsn(readSample(path));
    // A swallowed throw from a stub would still show as a call (R17.4).
    expect(network.fetch).not.toHaveBeenCalled();
    expect(network.XMLHttpRequest).not.toHaveBeenCalled();
    expect(result.issues).toEqual([]);
    const snap = await snapshot(result);
    expect(machinePaths(snap)).toEqual([]);
    await expect(goldenText(snap)).toMatchFileSnapshot(`./golden/${slug}.json`);
  },
);

/**
 * Strings that only the machine running the test could have put there. Windows paths written
 * inside the manifests (`publishUrl`, `managedCode/@projectPath`) are form content and stay.
 */
function machinePaths(snap: Snapshot): string[] {
  const local = [repoRoot, repoRoot.replace(/\/$/, ''), process.cwd(), homedir(), tmpdir()];
  const posixAbsolute = /(^|[\s"'=])\/(Users|home|private|var|tmp|opt|root)\//;
  return [...strings(snap)].filter(
    (s) => local.some((p) => s.includes(p)) || posixAbsolute.test(s) || s.startsWith('file:'),
  );
}

function* strings(s: Snapshot): Generator<string> {
  if (typeof s === 'string') yield s;
  else if (Array.isArray(s)) for (const x of s) yield* strings(x);
  else if (s !== null && typeof s === 'object') {
    for (const [k, v] of Object.entries(s)) {
      yield k;
      yield* strings(v);
    }
  }
}
