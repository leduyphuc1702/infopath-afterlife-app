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
  await page.getByRole('button', { name: 'Next' }).click();
  const host = page
    .getByRole('region', { name: /02-expense-report-001\.xml/ })
    .locator('[data-afl-paper]');
  await expect(host.locator('.afl-root')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
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
