import { gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { distAssets, readDist } from './dist';

// R10.1, design §7: gzip -9 sizes of the built files against the budgets.
const KB = 1024;
const gz = (rel: string) => gzipSync(readDist(rel), { level: 9 }).length;
// The entry script and stylesheet, as index.html loads them (dist has no manifest).
const index = readDist('index.html').toString('utf8');
const entry = {
  file: /<script type="module"[^>]* src="\.\/(assets\/[^"]+\.js)"/.exec(index)![1]!,
  css: [...index.matchAll(/<link rel="stylesheet"[^>]* href="\.\/(assets\/[^"]+\.css)"/g)].map(
    (m) => m[1]!,
  ),
};

test('budgets: entry, theme chunks, Worker, samples, Latin fonts', () => {
  const entrySize = gz(entry.file) + entry.css.reduce((n, c) => n + gz(c), 0);
  const js = distAssets().filter((f) => f.endsWith('.js'));
  const worker = js.filter((f) => f.startsWith('worker-'));
  const samples = js.filter((f) => f.startsWith('_virtual_sample-files-'));
  const more = js.filter((f) => f.startsWith('_virtual_sample-more-'));
  const others = js.filter(
    (f) =>
      !worker.includes(f) &&
      !samples.includes(f) &&
      !more.includes(f) &&
      `assets/${f}` !== entry.file,
  );
  const latin = distAssets().filter((f) => /^carlito-latin-(400|700)-(normal|italic)-/.test(f));
  const fonts = latin.reduce((n, f) => n + readDist(`assets/${f}`).length, 0);
  const sizes = {
    entry: entrySize,
    worker: gz(`assets/${worker[0]}`),
    samples: gz(`assets/${samples[0]}`),
    more: gz(`assets/${more[0]}`),
    fonts,
  };
  console.log(
    `R10.1 (KB): entry ${(sizes.entry / KB).toFixed(1)} / 100, theme chunks ${others.length} / 0, ` +
      `worker ${(sizes.worker / KB).toFixed(1)} / 160, samples ${(sizes.samples / KB).toFixed(1)} / 120, ` +
      `forms 09–42 ${(sizes.more / KB).toFixed(1)} / 200, ` +
      `Latin fonts ${(sizes.fonts / KB).toFixed(1)} raw / 260`,
  );
  expect([worker.length, samples.length, more.length, latin.length]).toEqual([1, 1, 1, 4]);
  expect(others).toEqual([]);
  expect(sizes.entry).toBeLessThanOrEqual(100 * KB);
  expect(sizes.worker).toBeLessThanOrEqual(160 * KB);
  expect(sizes.samples).toBeLessThanOrEqual(120 * KB);
  expect(sizes.more).toBeLessThanOrEqual(200 * KB);
  expect(sizes.fonts).toBeLessThanOrEqual(260 * KB);
});
