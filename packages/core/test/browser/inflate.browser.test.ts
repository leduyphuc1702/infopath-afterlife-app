import { commands } from 'vitest/browser';
import { expect, test } from 'vitest';
import type { InflateReply } from './inflate.worker';
import { runWorker } from './run-worker';

// Task 2 spike in a dedicated Worker (design D1–D3, R1.2, R17.2): the same 48 cabinets, inflated
// with the stored-block prefix, give the same folder SHA-256 as Node's zlib-dictionary oracle.

const cabinets = await commands.sampleCabinets();
const blockCounts = new Map<string, number>();

test('there are 48 cabinets', () => {
  expect(cabinets).toHaveLength(48);
});

test.each(cabinets.map((c) => [c.slug, c.path]))(
  '%s: Worker folder SHA-256 equals the zlib oracle',
  async (slug, path) => {
    const base64 = await commands.readFile(path, 'base64');
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    const reply = await runWorker<InflateReply>(
      new URL('./inflate.worker.ts', import.meta.url),
      bytes,
      [bytes.buffer],
    );
    expect(reply.error).toBeUndefined();
    expect(reply.sha256).toBe(await commands.zlibOracleSha256(path));
    blockCounts.set(slug, reply.blocks ?? 0);
  },
);

test('7 of them have more than one block, so the history path ran in the Worker', () => {
  expect(blockCounts.size).toBe(48);
  expect([...blockCounts.values()].filter((n) => n > 1)).toHaveLength(7);
});
