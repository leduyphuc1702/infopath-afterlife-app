// Spec 22: the first five minutes, as a newcomer meets them.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { pick, recordPaths } from './files';

const count = (page: Page) => page.locator('.afl-records-count');
const status = (page: Page) => page.locator('.afl-status');
const choose = (page: Page, label: string, option: string) =>
  page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
const focusText = (page: Page) =>
  page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return `${a?.tagName ?? ''} ${(a?.getAttribute('title') ?? a?.textContent ?? '').trim().slice(0, 40)}`;
  });
async function records02(page: Page) {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Expense report/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(count(page)).toHaveText('30 records.');
}

test('F1: the first click after a task lands does what it says', async ({ page }) => {
  await page.goto('./');
  await page.locator('.afl-tasks a[href="#read"]').click();
  await expect(page.locator('.afl-hint')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.afl-position')).toContainText('02-expense-report-002.xml');
  await page.goto('./');
  await page.locator('.afl-tasks a[href="#find"]').click();
  await expect(page.locator('.afl-hint')).toBeVisible();
  await page.getByRole('button', { name: 'Summarize' }).click();
  await expect(page.locator('.afl-summary')).toBeVisible();
});

test('S1: back from a record, the summary and the chosen group are as they were left', async ({
  page,
}) => {
  await records02(page);
  await page.getByRole('button', { name: 'Summarize' }).click();
  await choose(page, 'Count', 'Expense rows');
  await choose(page, 'Group by', 'Type');
  await page.locator('.afl-summary-table').getByRole('button', { name: 'Meals' }).click();
  await expect(count(page)).toHaveText('12 of 30 records match Type: Meals. Show every group');
  await page.locator('.afl-records-table tbody th button').nth(1).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(count(page)).toHaveText('12 of 30 records match Type: Meals. Show every group');
  await expect(page.getByRole('combobox', { name: 'Count', exact: true })).toHaveValue('0');
  await expect(page.locator('.afl-summary-picked th')).toHaveText('Meals');
});

test('S2: Download CSV says what was saved and keeps focus on its button', async ({ page }) => {
  await records02(page);
  await page.getByRole('button', { name: 'Summarize' }).click();
  await expect(page.locator('.afl-summary-table')).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  await dl;
  await expect(status(page)).toHaveText(
    'Saved expense-report-summary.csv: the summary, 3 groups and the line for all.',
  );
  await expect(page.getByRole('button', { name: 'Download CSV' })).toBeFocused();
});

test('S4: Forward after Back shows what Back left, for every task', async ({ page }) => {
  const checks: Record<string, () => Promise<void>> = {
    read: () => expect(page.locator('.afl-position')).toContainText('02-expense-report-001.xml'),
    rules: () =>
      expect(page.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'true'),
    fill: () =>
      expect(page.getByRole('tab', { name: 'Rule Trace' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    keep: () =>
      expect(page.getByRole('button', { name: 'Web pages to keep (.zip)' })).toBeVisible(),
    triage: () => expect(page.locator('#afl-triage-h')).toBeVisible(),
  };
  for (const [id, check] of Object.entries(checks)) {
    await page.goto('./');
    await page.locator(`.afl-tasks a[href="#${id}"]`).click();
    await check();
    await page.goBack();
    await expect(page.locator('#afl-tasks-h')).toBeFocused();
    await page.goForward();
    await check();
    await expect(page.locator('.afl-hint')).toBeVisible();
  }
});

test('S5: an unknown address typed while the app is open ends as on a cold load', async ({
  page,
}) => {
  await page.goto('./');
  await page.locator('.afl-tasks a[href="#rules"]').click();
  await expect(page.locator('.afl-hint')).toBeVisible();
  await page.evaluate(() => (location.hash = '#nonsense'));
  await expect(page.locator('#afl-tasks-h')).toBeFocused();
  await expect(page).not.toHaveURL(/#/);
});

test('S6: Close tip and Keep filling leave focus where a person can go on', async ({ page }) => {
  await page.goto('./#document');
  await page.getByRole('button', { name: 'Close tip' }).click();
  await expect(page.locator('#afl-doc-h')).toBeFocused();
  await page.goto('./');
  await page.goto('./#fill');
  await expect(page.getByRole('tab', { name: 'Rule Trace' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const qty = page.locator('[data-afl-paper] [title="Qty"]').first();
  await qty.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('9');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeEnabled();
  await qty.click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Keep filling' }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeFocused();
  // The question asked by Back while the person is in a field: Keep filling returns to the field.
  await qty.click();
  await page.goBack();
  await page.getByRole('button', { name: 'Keep filling' }).click();
  expect(await focusText(page)).toMatch(/^(SPAN|INPUT|DIV) Qty$/);
});

test('F2: files that open nothing are explained above the landing page, with focus', async ({
  page,
}) => {
  await page.goto('./');
  await pick(page, recordPaths('03-travel-request', 2));
  const h = page.getByRole('heading', { name: 'Records not matched (2)' });
  await expect(h).toBeFocused();
  await expect(h).toBeInViewport();
  await expect(page.locator('.afl-panel').first()).toContainText(
    'Drop the form’s .xsn template too',
  );
});

test('F4: a summary of nothing found says so', async ({ page }) => {
  await records02(page);
  await page.getByRole('button', { name: 'Summarize' }).click();
  await page.getByRole('searchbox', { name: 'Find' }).fill('zzzz');
  await expect(page.locator('.afl-summary')).toContainText(
    'Find matches no record, so there is nothing to summarize.',
  );
  await expect(page.locator('.afl-summary-table')).toHaveCount(0);
});

test('F5, F7: after a task, a later screen has no task address and no earlier status', async ({
  page,
}) => {
  await page.goto('./');
  await page.locator('.afl-tasks a[href="#keep"]').click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /Excel workbook/ }).click();
  await dl;
  await expect(status(page)).toContainText('Exported 20 records');
  // F6: the menu closed; focus is back on it.
  await expect(page.locator('summary', { hasText: 'Export records' })).toBeFocused();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(page).not.toHaveURL(/#/);
  await expect(status(page)).toHaveText('');
});

test('F8: in dark colours the bar shows on the chosen line', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await records02(page);
  await page.getByRole('button', { name: 'Summarize' }).click();
  await page.locator('.afl-summary-table').getByRole('button', { name: 'Euro' }).click();
  const [row, bar] = await page
    .locator('.afl-summary-picked')
    .evaluate((r) => [
      getComputedStyle(r).backgroundColor,
      getComputedStyle(r.querySelector('.afl-summary-bar')!).backgroundColor,
    ]);
  expect(bar).not.toBe(row);
});

test('F9: the Triage task’s first step is something the table does', async ({ page }) => {
  await page.goto('./#triage');
  await expect(page.locator('.afl-hint span')).toHaveText(
    'One row per form, with its wave. Open a form’s death certificate to see what stops it.',
  );
  // The one header button explains the waves; none sorts.
  await expect(page.locator('table thead th[aria-sort]')).toHaveCount(0);
});
