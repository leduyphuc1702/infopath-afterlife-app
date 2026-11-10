import { expect, test } from 'vitest';
import { runWorker } from './run-worker';

test('a dedicated module Worker has DecompressionStream and TextDecoder but no DOMParser', async () => {
  const report = await runWorker<Record<string, string>>(
    new URL('./harness.worker.ts', import.meta.url),
  );
  expect(report).toEqual({
    DecompressionStream: 'function',
    TextDecoder: 'function',
    DOMParser: 'undefined',
  });
});
