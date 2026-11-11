import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { pick, recordPaths, xsnPath } from './files';

// Spec 13: one regression test per web viewer bug, B1 to B10, each written to fail on the code
// before its fix.

const SUFFIX = ' · InfoPath Afterlife';
const triage = (page: Page) => page.getByRole('region', { name: 'Triage' });
const certificate = (page: Page) => page.getByRole('region', { name: /^Death certificate:/ });

async function openAll(page: Page) {
  await page.getByRole('button', { name: 'Triage all samples' }).click();
  await expect(triage(page).locator('tbody tr')).toHaveCount(48);
}

/** What the browser does before it prints: `beforeprint`, then print media. */
async function print(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('B1: the form screen prints the paper, fitted to the page, with one caption line', async ({
  page,
}) => {
  await pick(page, [xsnPath('08-big-form')]);
  await expect(page.locator('.afl-root')).toBeVisible();
  await print(page);
  const host = page.locator('[data-afl-paper]');
  await expect(host).toBeVisible();
  expect(
    (await host.evaluate((h) => (h.shadowRoot?.textContent ?? '').trim())).length,
  ).toBeGreaterThan(0);
  await expect(page.locator('.afl-print-caption')).toBeVisible();
  await expect(page.locator('.afl-print-caption')).toHaveText(/^.+, .+ view, empty form$/);
  for (const hidden of ['.afl-header', '.afl-toolbar', '.afl-side', '.afl-footer'])
    await expect(page.locator(hidden)).toBeHidden();
  // 180 mm: the narrower of A4 and Letter inside the 15 mm margins, in CSS pixels.
  const width = await host.evaluate((h) => h.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual((180 / 25.4) * 96 + 1);
  expect(await host.evaluate((h) => getComputedStyle(h.parentElement!).overflow)).toBe('visible');
});

test('B1: the certificate screen prints the certificate', async ({ page }) => {
  await pick(page, [xsnPath('01-leave-request'), xsnPath('04-purchase-request')]);
  await triage(page).getByRole('button', { name: /Leave/ }).first().click();
  await print(page);
  await expect(page.getByRole('heading', { name: /^Death certificate:/ })).toBeVisible();
  await expect(certificate(page).getByRole('article').first()).toBeVisible();
  await expect(page.locator('.afl-header')).toBeHidden();
});

test('B2: Back and Forward move between the screens, with the session intact', async ({ page }) => {
  await openAll(page);
  await triage(page)
    .getByRole('button', { name: /^Expense report/ })
    .click();
  await expect(certificate(page)).toBeVisible();
  await page.getByRole('button', { name: 'Open form' }).click();
  await expect(page.getByRole('toolbar', { name: 'Views and records' })).toBeVisible();
  await page.goBack();
  await expect(certificate(page)).toBeVisible();
  await page.goBack();
  await expect(triage(page).locator('tbody tr')).toHaveCount(48);
  await page.goForward();
  await expect(certificate(page)).toBeVisible();
  await page.goForward();
  // The toolbar and the title name the form as its template does.
  await expect(page.getByRole('toolbar', { name: 'Views and records' })).toContainText(
    'Expense Report',
  );
});

test('B3: the same template opened twice is one form, with a note', async ({ page }) => {
  await pick(page, [xsnPath('02-expense-report')]);
  await expect(page.locator('.afl-root')).toBeVisible();
  await pick(page, [xsnPath('02-expense-report')]);
  await expect(page.getByRole('status').or(page.locator('.afl-status'))).toContainText(
    '02-expense-report.xsn is already open',
  );
  await expect(triage(page)).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Views and records' })).toContainText(
    'Expense Report',
  );
});

test('B4: a template with its records shows the first record; Previous shows the empty form', async ({
  page,
}) => {
  await pick(page, [xsnPath('02-expense-report'), ...recordPaths('02-expense-report', 3)]);
  await expect(page.getByText('Record 1 of 3, 02-expense-report-001.xml')).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByText('Empty form', { exact: true })).toBeVisible();
  // A record dropped for the open template is shown.
  await pick(page, recordPaths('02-expense-report', 5).slice(4));
  await expect(page.getByText('Record 4 of 4, 02-expense-report-005.xml')).toBeVisible();
});

test('B5: Escape closes an open menu and gives focus back to its button', async ({ page }) => {
  const summary = page.locator('.afl-header .afl-menu summary');
  await summary.click();
  await expect(page.locator('.afl-header .afl-menu')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('.afl-header .afl-menu')).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  // A click outside closes it too.
  await summary.click();
  await page.locator('h1').click();
  await expect(page.locator('.afl-header .afl-menu')).not.toHaveAttribute('open', '');
});

test('B6: focus moves to the new screen; Back to Triage restores the scroll and the button', async ({
  page,
}) => {
  await openAll(page);
  const row40 = triage(page).locator('tbody tr').nth(39).getByRole('button');
  await row40.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  expect(y).toBeGreaterThan(0);
  await row40.click();
  await expect(page.locator('#afl-cert-h')).toBeFocused();
  await page.getByRole('button', { name: 'Back to Triage' }).click();
  await expect(row40).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(2);
  await row40.click();
  await page.getByRole('button', { name: 'Open form' }).click();
  await expect(page.locator('.afl-form-name')).toBeFocused();
});

test('B7: the title names the screen first', async ({ page }) => {
  const landing = await page.title();
  expect(landing).toBe('InfoPath Afterlife: open old InfoPath forms in your browser');
  await openAll(page);
  await expect(page).toHaveTitle(`Triage: 48 forms${SUFFIX}`);
  await triage(page)
    .getByRole('button', { name: /^Expense report/ })
    .click();
  await expect(page).toHaveTitle(`Death certificate: Expense report${SUFFIX}`);
  await page.getByRole('button', { name: 'Open form' }).click();
  await expect(page).toHaveTitle(`Expense Report${SUFFIX}`);
});

test('B8: at 390 px the Triage table scrolls from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pick(page, [xsnPath('01-leave-request'), xsnPath('04-purchase-request')]);
  const scroller = page.locator('.afl-triage-scroll');
  await expect(scroller).toHaveAttribute('tabindex', '0');
  await expect(scroller).toHaveAttribute('role', 'region');
  await expect(scroller).toHaveAccessibleName('Table of forms');
  await scroller.focus();
  expect(await scroller.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scroller.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
});

test('B9: at 390 px no header button label wraps, and the page does not scroll sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Expense report/ }).click();
  await expect(page.locator('.afl-root')).toBeVisible();
  // The lines each label's text sits on.
  const lines = await page.locator('.afl-header .afl-button').evaluateAll((els) =>
    els.map((e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      return `${e.textContent}: ${new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size}`;
    }),
  );
  expect(lines.length).toBeGreaterThan(2);
  expect(lines.filter((l) => !l.endsWith(': 1'))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('B10: files not opened are announced politely, once per drop', async ({ page }) => {
  const live = page.locator('[data-afl-announce]');
  await pick(page, [{ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }]);
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await expect(live).toHaveText('Files not opened: note.txt.');
  await pick(page, recordPaths('01-leave-request', 1));
  await expect(live).toHaveText('Records not matched: 01-leave-request-001.xml.');
});
