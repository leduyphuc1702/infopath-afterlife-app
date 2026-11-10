/// <reference types="vite/client" />
import { commands } from 'vitest/browser';
import { expect, test } from 'vitest';
import { renderGoldenPath } from '../helpers/render-golden';
import type { SliceReply, SliceRequest } from './render-slice.worker';
import { runWorker } from './run-worker';

// Spec 03 task 4 (R1.4, R5.3 for the slice): form 01's default view, with its empty and first
// records, rendered in a Chromium Worker built with core's fs/path stubs, is byte-identical to
// the Node goldens. Task 9 extends this to the 106 renders.

const golden = import.meta.glob<string>('../golden/render/**/*.json', {
  query: '?raw',
  import: 'default',
});
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
const cabinet = (await commands.sampleCabinets()).find((c) => c.slug === '01-leave-request')!;
const records = cabinet.formsDir!.replace('/forms/', '/records/');

test.each([
  ['empty', '000-empty'],
  ['first', '001'],
] as const)('form 01 %s record: Worker render equals the Node golden', async (record, suffix) => {
  const request: SliceRequest = {
    xsn: fromBase64(await commands.readFile(cabinet.path, 'base64')),
    record: fromBase64(
      await commands.readFile(`${records}01-leave-request-${suffix}.xml`, 'base64'),
    ),
    view: 'Request',
  };
  const reply = await runWorker<SliceReply>(
    new URL('./render-slice.worker.ts', import.meta.url),
    request,
    [request.xsn.buffer, request.record.buffer],
  );
  expect(reply.error).toBeUndefined();
  const file = golden[`../${renderGoldenPath('01-leave-request', 'view1.xsl', record)}`];
  expect(file).toBeDefined();
  expect(reply.text).toBe(await file!());
});

test('the slice Worker bundles with only xsltjs fs/path mapped to the stubs', async () => {
  const result = await commands.buildWorkerBundle('test/browser/render-slice.worker.ts');
  expect(result.error).toBeUndefined();
  expect(result.ok).toBe(true);
  expect(result.modules).toEqual(
    expect.arrayContaining(['src/render/engine/stubs/fs.ts', 'src/render/engine/stubs/path.ts']),
  );
});
