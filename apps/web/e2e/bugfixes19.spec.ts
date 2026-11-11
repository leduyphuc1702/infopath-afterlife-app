// Spec 19: the records list, the archive menu and the dossier's print, as a person meets them.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const rows = (page: Page) => page.locator('.afl-records-table tbody tr[aria-rowindex]');
const status = (page: Page) => page.locator('.afl-records-count');
const find = (page: Page) => page.getByRole('searchbox', { name: 'Find' });
async function records(page: Page, sample = /^Expense report/) {
  await page.goto('./');
  await page.getByRole('button', { name: sample }).first().click();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(rows(page).first()).toBeVisible();
}

test('R1: opening a record from Records asks about unsaved Fill changes; read mode shows the record', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Expense report/ })
    .first()
    .click();
  await page.getByRole('switch', { name: 'Fill' }).click();
  await expect(page.locator('[data-afl-paper][data-afl-renders]')).toBeVisible();
  const amount = page
    .locator('[data-afl-paper] [data-afl-path$="/my:expense[1]/my:amount[1]"]')
    .first();
  await amount.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('77');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await rows(page).nth(4).locator('th button').click();
  const dialog = page.getByRole('dialog', { name: 'Discard your changes?' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Keep filling' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-screen', 'records');
  await rows(page).nth(4).locator('th button').click();
  await dialog.getByRole('button', { name: /^Discard/ }).click();
  await expect(page.locator('.afl-position')).toContainText('02-expense-report-005.xml');
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.locator('.afl-position')).toContainText('02-expense-report-001.xml');
  const shown = () =>
    page
      .locator('[data-afl-paper]')
      .evaluate((p) => p.shadowRoot!.querySelector('.afl-root')!.textContent);
  await expect.poll(shown).toContain('$55.39');
  expect(await shown()).not.toContain('$77.00');
});

test('R2, R3, F1: Failed checks beside the file name; Find looks in rows and in dropdown names', async ({
  page,
}) => {
  await records(page);
  const heads = await page.locator('.afl-records-table thead th').allTextContents();
  expect(heads.slice(0, 3)).toEqual(['File name', 'Failed checks', 'Template version']);
  expect(await rows(page).first().locator('td').first().textContent()).toBe('None');
  // F1: the paper says "Sales"; so does the list, and Find finds it by that name.
  await expect(rows(page).first()).toContainText('Sales');
  await find(page).fill('finance');
  await expect(status(page)).toHaveText(/^[1-9]\d* of 30 records match\.$/);
  // R2: a value in a repeating row, with where it is.
  await find(page).fill('lodging');
  await expect(status(page)).toHaveText(/^[1-9]\d* of 30 records match\.$/);
  await expect(rows(page).first().locator('.afl-records-where')).toHaveText(/Type: Lodging/);
});

test('R4: no match says so in the box, and Clear Find brings the records back', async ({
  page,
}) => {
  await records(page);
  await find(page).fill('zzzz');
  await expect(page.locator('.afl-records-none')).toHaveText(
    'No record matches “zzzz”. Clear Find',
  );
  await page.getByRole('button', { name: 'Clear Find' }).click();
  await expect(status(page)).toHaveText('30 records.');
  await expect(find(page)).toBeFocused();
});

test('F4: Enter in Find goes to the first record; Down to the next', async ({ page }) => {
  await records(page);
  await find(page).fill('dollar');
  await expect(status(page)).toHaveText(/^\d+ of 30 records match\.$/);
  await page.keyboard.press('Enter');
  const names = await rows(page).locator('th button').allTextContents();
  await expect(page.getByRole('button', { name: names[0]!, exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: names[1]!, exact: true })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: names[0]!, exact: true })).toBeFocused();
});

test('R5: on a phone the file name keeps two fifths of the width; Failed checks is next', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await records(page);
  const w = await rows(page)
    .first()
    .locator('th')
    .evaluate((t) => t.getBoundingClientRect().width);
  expect(w).toBeLessThanOrEqual(0.4 * 390 + 1);
  await expect(page.locator('.afl-records-table thead th').nth(1)).toHaveText('Failed checks');
});

test('F5: at 200% zoom (640×400) the list shows more than a few rows', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await records(page);
  const h = await page.locator('.afl-records-box').evaluate((b) => b.clientHeight);
  expect(h).toBeGreaterThanOrEqual(250);
});

test('A2, F2: the archive is a choice of Export records; focus returns to the menu', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^New hire/ })
    .first()
    .click();
  await expect(
    page.locator('.afl-toolbar summary', { hasText: 'Archive as web pages' }),
  ).toHaveCount(0);
  const menu = page.locator('summary', { hasText: 'Export records' });
  await menu.click();
  await page.getByRole('checkbox', { name: 'Manager' }).uncheck();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Web pages to keep (.zip)' }).click();
  await dl;
  await expect(page.locator('.afl-status')).toContainText('as 40 web pages');
  await expect(menu).toBeFocused();
});

test('P1: the printed fields table keeps its words whole', async ({ page }) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Purchase request/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Documentation' }).click();
  await expect(page.locator('#afl-doc-h')).toBeFocused();
  await page.setViewportSize({ width: 718, height: 1000 });
  await page.emulateMedia({ media: 'print' });
  const broken = await page
    .locator('.afl-doc-fields th, .afl-doc-fields td:not(:has(code))')
    .evaluateAll((cells) =>
      cells.flatMap((c) => {
        // A break at a hyphen the text already has is fine.
        const words = (c.textContent ?? '').split(/[\s,()-]+/).filter(Boolean);
        const r = document.createRange();
        return words.flatMap((w) => {
          const i = (c.textContent ?? '').indexOf(w);
          const node = [...c.childNodes].find(
            (n) => n.nodeType === 3 && n.textContent!.includes(w),
          );
          if (!node || i < 0) return [];
          const at = node.textContent!.indexOf(w);
          r.setStart(node, at);
          r.setEnd(node, at + w.length);
          return r.getClientRects().length > 1 ? [w] : [];
        });
      }),
    );
  expect(broken).toEqual([]);
});
