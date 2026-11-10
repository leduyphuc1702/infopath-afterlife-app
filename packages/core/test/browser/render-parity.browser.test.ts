/// <reference types="vite/client" />
import { commands } from 'vitest/browser';
import { expect, test } from 'vitest';
import type { ParityReply, ParityRequest } from './render-parity.worker';
import { runWorker } from './run-worker';

// Spec 03 task 9 (R5.3, design §10): the 106 golden renders (53 views × empty and first
// records), made again in a Chromium Worker built with core's fs/path stubs and a throwing
// `fetch`, are byte-identical to the Node goldens. This project only reads the goldens; the
// Node project (test/render/golden.samples.test.ts) writes them.

const golden = import.meta.glob<string>('../golden/render/**/*.json', {
  query: '?raw',
  import: 'default',
});
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
const read = async (path: string) => fromBase64(await commands.readFile(path, 'base64'));
const cabinets = await commands.sampleCabinets();

const compared = new Set<string>();

test.each(cabinets.map((c) => [c.slug, c] as const))(
  '%s: every Worker render equals its Node golden',
  async (slug, c) => {
    const xsn = await read(c.path);
    let request: ParityRequest = { slug, xsn };
    const transfer: Transferable[] = [xsn.buffer];
    if (c.formsDir !== undefined) {
      const dir = c.formsDir.replace('/forms/', '/records/');
      const records = {
        empty: await read(`${dir}${slug}-000-empty.xml`),
        first: await read(`${dir}${slug}-001.xml`),
      };
      request = { slug, xsn, records };
      transfer.push(records.empty.buffer, records.first.buffer);
    }
    const reply = await runWorker<ParityReply>(
      new URL('./render-parity.worker.ts', import.meta.url),
      request,
      transfer,
    );
    expect(reply.error).toBeUndefined();
    expect(reply.fetchCalls).toBe(0);
    const files = Object.entries(reply.files!);
    expect(files.length).toBeGreaterThan(0);
    for (const [path, text] of files) {
      const file = golden[`../${path}`];
      expect(file, path).toBeDefined();
      expect(text, path).toBe(await file!());
      compared.add(path);
    }
  },
);

test('all 106 goldens were compared, and no Worker render lacks one', () => {
  expect([...compared].sort()).toEqual(
    Object.keys(golden)
      .map((k) => k.slice('../'.length))
      .sort(),
  );
  expect(compared.size).toBe(106);
});

test('the parity Worker bundles with only xsltjs fs/path mapped to the stubs', async () => {
  const result = await commands.buildWorkerBundle('test/browser/render-parity.worker.ts');
  expect(result.error).toBeUndefined();
  expect(result.ok).toBe(true);
  expect(result.modules).toEqual(
    expect.arrayContaining(['src/render/engine/stubs/fs.ts', 'src/render/engine/stubs/path.ts']),
  );
});
