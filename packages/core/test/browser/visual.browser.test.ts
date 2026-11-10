/// <reference types="vite/client" />
import { commands, page, server } from 'vitest/browser';
import { beforeAll, expect, test } from 'vitest';
import { buildFormIR, parseXsn, prepareView, renderView } from '../../src/index';
import { GOLDEN_INPUT } from '../helpers/render-golden';
import { loadCarlito } from './carlito';

// Spec 03 R10.2 (task 14): the default views of forms 01–08, with the empty record
// (`-000-empty.xml`) and the first record (`-001.xml`), 16 renders, each compared with a baseline
// PNG of our own render, named as the InfoPath screenshots are (`<slug>-<view caption>-…`). The canvas is the InfoPath screenshots' size, 1007×555, white, with the
// render root at its top-left (the view's own `BODY{margin-left:21px}` places the form as
// InfoPath did). Calibri resolves to Carlito (carlito.ts).
//
// Vitest's `toMatchScreenshot` takes screenshots until two in a row match, then compares with
// pixelmatch; baselines live in __screenshots__/visual.browser.test.ts/<name>-chromium-darwin.png.
// Font rasterisation differs by OS, so the baselines are for macOS Chromium only: elsewhere the
// test skips with a message. Threshold (R10.2, set at review): pixelmatch `threshold: 0.1` per
// pixel and at most 0.1% of the canvas (559 pixels) different. The goldens already catch content
// changes byte by byte; this test is for layout regressions, which move far more than that.

const PLATFORM = 'darwin';
const WIDTH = 1007;
const HEIGHT = 555;
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
const read = async (path: string) => fromBase64(await commands.readFile(path, 'base64'));
const cabinets = (await commands.sampleCabinets()).filter((c) => /^0[1-8]-/.test(c.slug));
let canvas: HTMLElement;

beforeAll(async () => {
  if (server.platform !== PLATFORM) return;
  await page.viewport(WIDTH + 100, HEIGHT + 100);
  document.body.style.margin = '0';
  await loadCarlito();
  canvas = document.createElement('div');
  canvas.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#fff`;
  document.body.append(canvas);
});

test('forms 01–08', () => {
  expect(cabinets).toHaveLength(8);
});

test.for(
  cabinets.flatMap((c) => (['empty', 'first'] as const).map((r) => [c.slug, r, c] as const)),
)('%s default view, %s record, matches its baseline', async ([slug, record, c], ctx) => {
  ctx.skip(
    server.platform !== PLATFORM,
    `visual baselines are for macOS Chromium; this is ${server.platform} ${server.browser}`,
  );
  const t = await parseXsn(await read(c.path));
  const ir = buildFormIR(t);
  const view = ir.views.find((v) => v.isDefault)!;
  const dir = c.formsDir!.replace('/forms/', '/records/');
  const r = renderView(await prepareView(t, ir), {
    ...GOLDEN_INPUT,
    record: await read(`${dir}${slug}-${record === 'empty' ? '000-empty' : '001'}.xml`),
  });
  canvas.innerHTML = `<style>${r.css}</style>${r.html}`;
  await document.fonts.ready;
  await expect
    .element(page.elementLocator(canvas))
    .toMatchScreenshot(`${slug}-${(view.caption ?? view.name).replace(/\s+/g, '-')}-${record}`, {
      comparatorName: 'pixelmatch',
      comparatorOptions: { threshold: 0.1, allowedMismatchedPixelRatio: 0.001 },
    });
});
