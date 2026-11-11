import { readFileSync } from 'node:fs';
import { platform } from 'node:os';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { expect, test } from './fixtures';

// Spec 09 R3.1, R3.3 (task 3, the walking skeleton): "Try a sample" for form 02 renders on the
// paper, from the Worker, in the built `dist`, under the CSP.
const core = new URL('../../../packages/core/test/', import.meta.url);
const golden = (slug: string, file: string) =>
  JSON.parse(readFileSync(new URL(`golden/render/${slug}/${file}`, core), 'utf8')) as {
    marks: unknown[];
  };

test('sample 02 renders its default view on the paper, from the Worker', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Expense report/ }).click();
  // Spec 13 B4: the sample opens on record 1; the empty form is one Previous away.
  await page.getByRole('button', { name: 'Previous' }).click();
  const paper = page.getByRole('region', { name: /Claim view, empty form/ });
  await expect(paper.locator('.afl-root')).toBeVisible();
  // The template's own empty form (template.xml) holds one blank expense row, which the
  // `-000-empty.xml` record of core's golden does not: 7 controls plus the row's 5.
  await expect(paper.locator('[data-afl-ctrl]')).toHaveCount(
    golden('02-expense-report', 'view1.empty.json').marks.length + 5,
  );
  // The root core returns is inert, and it sits in a shadow root.
  expect(
    await page
      .locator('[data-afl-paper]')
      .evaluate((h) => h.shadowRoot?.querySelector('.afl-root')?.hasAttribute('inert')),
  ).toBe(true);
  // Record 1 has as many controls as core's golden for it.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Record 1 of 30, 02-expense-report-001.xml')).toBeVisible();
  await expect(
    page.getByRole('region', { name: /02-expense-report-001\.xml/ }).locator('[data-afl-ctrl]'),
  ).toHaveCount(golden('02-expense-report', 'view1.first.json').marks.length);
});

// R3.3: the paper inside the app draws exactly what core's visual test draws, compared with core's
// baseline at core's threshold. The baselines are macOS Chromium renders, as in core.
test('sample 02 record 1 matches core baseline 02-expense-report-Claim-first', async ({ page }) => {
  test.skip(platform() !== 'darwin', 'core baselines are macOS Chromium renders');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('./');
  await page.getByRole('button', { name: /^Expense report/ }).click();
  const host = page
    .getByRole('region', { name: /02-expense-report-001\.xml/ })
    .locator('[data-afl-paper]');
  await expect(host.locator('.afl-root')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The first render's sepia fade (R9.3) has ended.
  await expect.poll(() => host.evaluate((h) => getComputedStyle(h).filter)).toBe('none');
  const box = (await host.boundingBox())!;
  const shot = PNG.sync.read(
    await page.screenshot({ clip: { x: box.x, y: box.y, width: 1007, height: 555 } }),
  );
  const base = PNG.sync.read(
    readFileSync(
      new URL(
        'browser/__screenshots__/visual.browser.test.ts/02-expense-report-Claim-first-chromium-darwin.png',
        core,
      ),
    ),
  );
  expect([shot.width, shot.height]).toEqual([base.width, base.height]);
  const diff = pixelmatch(shot.data, base.data, undefined, base.width, base.height, {
    threshold: 0.1,
  });
  console.log(`R3.3: ${diff} of ${base.width * base.height} pixels differ`);
  expect(diff).toBeLessThanOrEqual(Math.floor(base.width * base.height * 0.001));
});

// R3.1: the view selector lists every view by caption; choosing one re-renders the same record.
for (const [label, count] of [
  ['New hire onboarding', 3],
  ['Travel request', 2],
] as const) {
  test(`sample "${label}": ${count} views, each one renders`, async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    const select = page.getByRole('toolbar', { name: 'Views and records' }).getByLabel('View');
    await expect(page.locator('.afl-root')).toBeVisible();
    const captions = await select.locator('option').allTextContents();
    expect(captions).toHaveLength(count);
    for (const caption of captions) {
      await select.selectOption({ label: caption });
      const region = page.getByRole('region', {
        name: new RegExp(`${caption} view, .*-001\\.xml$`),
      });
      await expect(region.locator('.afl-root')).toBeVisible();
    }
  });
}

// R3.3: no page style or colour scheme reaches the paper. Every element's computed style is the
// same in light and dark mode (the page around it does change).
test('the paper computes the same styles in light and dark colour schemes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: /^Expense report/ }).click();
  const host = page
    .getByRole('region', { name: /02-expense-report-001\.xml/ })
    .locator('[data-afl-paper]');
  await expect(host.locator('.afl-root')).toBeVisible();
  // Custom properties (`--ds-*`) inherit into every shadow root, but nothing on the paper reads
  // them: the render's CSS has no `var(`. The host's own `box-shadow` is the page's frame, not
  // the paper, so it is left out.
  expect(
    await host.evaluate((h) => h.shadowRoot!.querySelector('style')!.textContent),
  ).not.toContain('var(');
  const styles = () =>
    host.evaluate((h) =>
      [h, ...h.shadowRoot!.querySelectorAll('*')].map((e, i) => {
        const cs = getComputedStyle(e);
        return [...cs]
          .filter((p) => !p.startsWith('--') && !(i === 0 && p === 'box-shadow'))
          .map((p) => `${p}:${cs.getPropertyValue(p)}`)
          .join(';');
      }),
    );
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await styles();
  const lightBg = await bodyBg();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  const dark = await styles();
  expect(await bodyBg()).not.toBe(lightBg);
  expect(light.length).toBeGreaterThan(50);
  const differ = light.flatMap((l, i) => {
    if (l === dark[i]) return [];
    const d = new Set(dark[i]!.split(';'));
    return [
      `${i}: ${l
        .split(';')
        .filter((x) => !d.has(x))
        .join('; ')}`,
    ];
  });
  expect(differ.slice(0, 3)).toEqual([]);
});

// R9.3: the first render of a template fades from sepia to clean within 1.2 s; later renders of
// it do not; under reduced motion no filter is ever set. A MutationObserver records every filter
// written to the paper host's style.
const watchFilters = () => {
  const w = window as unknown as { __aflFilters: string[] };
  w.__aflFilters = [];
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target as HTMLElement;
      const f = el.hasAttribute('data-afl-paper') ? el.style.filter : '';
      // One entry per change of value (setting `transition` also queues a record).
      if (f && f !== w.__aflFilters.at(-1)) w.__aflFilters.push(f);
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style'] });
};
const filters = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __aflFilters: string[] }).__aflFilters);

test('the first render of a template fades from sepia to clean, once', async ({ page }) => {
  await page.addInitScript(watchFilters);
  await page.goto('./');
  await page.getByRole('button', { name: /^New hire onboarding/ }).click();
  const host = page.locator('[data-afl-paper]');
  await expect(host.locator('.afl-root')).toBeAttached();
  const start = Date.now();
  await expect
    .poll(() => host.evaluate((h) => getComputedStyle(h).filter), { intervals: [50] })
    .toBe('none');
  const took = Date.now() - start;
  expect(await filters(page)).toEqual(['sepia(0.85) contrast(0.92)', 'none']);
  expect(took).toBeLessThan(1200 + 400);
  // Paging and another view of the same template: no new filter.
  await page.getByRole('button', { name: 'Next' }).click();
  await page
    .getByRole('toolbar', { name: 'Views and records' })
    .getByLabel('View')
    .selectOption({ index: 1 });
  await expect(
    page.getByRole('region', { name: /-002\.xml$/ }).locator('.afl-root'),
  ).toBeAttached();
  await page.waitForTimeout(300);
  expect(await filters(page)).toEqual(['sepia(0.85) contrast(0.92)', 'none']);
});

test('under reduced motion no filter is ever set', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(watchFilters);
  await page.goto('./');
  await page.getByRole('button', { name: /^New hire onboarding/ }).click();
  const host = page.locator('[data-afl-paper]');
  await expect(host.locator('.afl-root')).toBeAttached();
  for (let i = 0; i < 6; i++) {
    expect(await host.evaluate((h) => getComputedStyle(h).filter)).toBe('none');
    await page.waitForTimeout(100);
  }
  expect(await filters(page)).toEqual([]);
});
