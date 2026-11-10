/// <reference types="vite/client" />
import { commands } from 'vitest/browser';
import { expect, test } from 'vitest';
import type { Snapshot } from '../helpers/snapshot';
import type { ParseReply } from './parse.worker';
import { runWorker } from './run-worker';

// R17.3: every cabinet parsed in a dedicated Worker equals its Node golden file. This project
// only reads the golden files; the Node project writes them. R17.1: the Worker entry is bundled
// by Vite with every Node built-in refused, and the build must succeed.

const cabinets = await commands.sampleCabinets();
const golden = import.meta.glob<Snapshot>('../golden/*.json', { import: 'default' });
const goldenPath = (slug: string) => `../golden/${slug}.json`;

test('one golden file per cabinet, and no other', () => {
  expect(cabinets).toHaveLength(48);
  expect(Object.keys(golden).sort()).toEqual(cabinets.map((c) => goldenPath(c.slug)).sort());
});

test.each(cabinets.map((c) => [c.slug, c.path]))(
  '%s: Worker result equals the golden file',
  async (slug, path) => {
    const base64 = await commands.readFile(path, 'base64');
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    const reply = await runWorker<ParseReply>(
      new URL('./parse.worker.ts', import.meta.url),
      bytes,
      [bytes.buffer],
    );
    expect(reply.error).toBeUndefined();
    expect(reply.snap).toEqual(await golden[goldenPath(slug)]!());
  },
);

test('the Worker bundle builds with no Node built-in (R17.1)', async () => {
  const r = await commands.buildWorkerBundle('test/browser/parse.worker.ts');
  expect(r.error).toBeUndefined();
  expect(r.ok).toBe(true);
  console.log(`Worker bundle: ${r.modules.length} modules, ${r.bytes} bytes`);
  // The bundle is the parser, not an empty shell: core's entry and its one dependency are in it.
  expect(r.modules).toContain('src/index.ts');
  expect(r.modules).toContain('node_modules/@xmldom/xmldom');
  expect(r.modules.filter((m) => m.startsWith('node_modules/'))).toEqual([
    'node_modules/@xmldom/xmldom',
  ]);
});

test('the same build fails when an entry imports node:fs, so the check can fail', async () => {
  // NODE_IMPORT_PROBE in helpers/worker-bundle.ts: an entry that imports node:fs.
  const r = await commands.buildWorkerBundle('virtual:node-import-probe');
  expect(r.ok).toBe(false);
  expect(r.error).toContain('Node built-in "node:fs"');
});
