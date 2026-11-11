/// <reference types="vite/client" />
import { commands } from 'vitest/browser';
import { afterAll, expect, test } from 'vitest';
import type { PerfReply, PerfRequest } from './render-perf.worker';
import { runWorker } from './run-worker';

// Spec 03 R9.1 (design §10): the 106 renders timed in a Chromium Worker built with core's
// fs/path stubs: 2 warm-ups and 20 timed renders per view and record; p95 under 100 ms
// (nearest rank, the 19th of 20). Form 08 is reported on its own line.

const BUDGET_MS = 100;
const BIG = '08-big-form';
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
const read = async (path: string) => fromBase64(await commands.readFile(path, 'base64'));
const cabinets = await commands.sampleCabinets();
const rows: { id: string; p50: number; p95: number; max: number }[] = [];

test.each(cabinets.map((c) => [c.slug, c] as const))(
  `%s: every render's p95 in a Worker is under ${BUDGET_MS} ms`,
  async (slug, c) => {
    const xsn = await read(c.path);
    let request: PerfRequest = { slug, xsn };
    if (c.formsDir !== undefined) {
      const dir = c.formsDir.replace('/forms/', '/records/');
      request = {
        slug,
        xsn,
        records: {
          empty: await read(`${dir}${slug}-000-empty.xml`),
          first: await read(`${dir}${slug}-001.xml`),
        },
      };
    }
    const measure = async () => {
      const reply = await runWorker<PerfReply>(
        new URL('./render-perf.worker.ts', import.meta.url),
        request,
      );
      expect(reply.error).toBeUndefined();
      return Object.entries(reply.times!).map(([id, times]) => ({
        id,
        p50: times[9]!,
        p95: times[18]!,
        max: times[19]!,
      }));
    };
    // Spec 19 T1: the budget stays; a miss is measured once more before it fails.
    let found = await measure();
    const again = found.some((r) => r.p95 >= BUDGET_MS);
    if (again) found = await measure();
    for (const row of found) {
      rows.push(row);
      expect(
        row.p95,
        `${row.id}${again ? ': measured twice; over the budget both times. The machine may be busy: run it again when it is idle' : ''}`,
      ).toBeLessThan(BUDGET_MS);
    }
  },
  120_000,
);

test('106 renders were timed', () => {
  expect(rows).toHaveLength(106);
});

afterAll(() => {
  const ms = (n: number) => n.toFixed(2).padStart(8);
  const sorted = [...rows].sort((a, b) => b.p95 - a.p95);
  const width = Math.max(...rows.map((r) => r.id.length));
  const lines = [
    `renderView in a Chromium Worker: 2 warm-up + 20 timed renders (ms), slowest 10 by p95`,
    ...sorted
      .slice(0, 10)
      .map((r) => `${r.id.padEnd(width)} ${ms(r.p50)} ${ms(r.p95)} ${ms(r.max)}`),
  ];
  for (const r of rows.filter((x) => x.id.startsWith(`${BIG}/`)))
    lines.push(`${BIG} (R9.1): ${r.id} p50 ${r.p50.toFixed(2)} ms, p95 ${r.p95.toFixed(2)} ms`);
  const worst = sorted.find((r) => !r.id.startsWith(`${BIG}/`));
  if (worst)
    lines.push(
      `slowest p95 other than form 08: ${worst.id} ${worst.p95.toFixed(2)} ms (budget ${BUDGET_MS} ms)`,
    );
  console.log(lines.join('\n'));
});
