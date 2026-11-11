// Spec 20: summarize the records found, as a person does it on the Records screen.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

const status = (page: Page) => page.locator('.afl-records-count');
const summary = (page: Page) => page.locator('.afl-summary-table');
const lines = (page: Page) =>
  summary(page)
    .locator('tbody tr, tfoot tr')
    .evaluateAll((rs) =>
      rs.map((r) => [...r.children].map((c) => (c.textContent ?? '').replace(/[▲▼]/g, '').trim())),
    );
async function open02(page: Page) {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Expense report/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(status(page)).toHaveText('30 records.');
  await page.getByRole('button', { name: 'Summarize' }).click();
}
const choose = (page: Page, label: string, option: string) =>
  page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });

test('R1, R4, R6, R7: Total by Department on form 02', async ({ page }) => {
  await open02(page);
  await choose(page, 'Group by', 'Department');
  await choose(page, 'Total of', 'Total');
  await expect(summary(page).locator('caption')).toHaveText(
    '30 records, grouped by Department, with the total of Total. Choose a group to list its records.',
  );
  const t = await lines(page);
  console.log('Total by Department\n' + t.map((r) => r.join(' | ')).join('\n'));
  expect(t.at(-1)).toEqual(['All', '30', '$24,440.53', '$814.68']);
  expect(t.map((r) => r[0])).toContain('Sales');
  expect(await summary(page).locator('.afl-summary-bar').first().getAttribute('aria-hidden')).toBe(
    'true',
  );
  await summary(page)
    .getByRole('button', { name: /^Sum of Total/ })
    .click();
  await expect(summary(page).locator('thead th').nth(2)).toHaveAttribute('aria-sort', 'descending');
  // The Worker answers the new order shortly after the click.
  const sums = async () =>
    (await lines(page)).slice(0, -1).map((r) => Number(r[2]!.replace(/[$,]/g, '')));
  await expect.poll(async () => (await sums())[0]).toBe(5649.81);
  const s = await sums();
  expect(s).toEqual([...s].sort((a, b) => b - a));
});

test('R5, R8: Amount by Expense type counts rows; a line lists its records with Find', async ({
  page,
}) => {
  await open02(page);
  await choose(page, 'Count', 'Expense rows');
  await choose(page, 'Group by', 'Type');
  await choose(page, 'Total of', 'Amount');
  await expect(summary(page).locator('caption')).toContainText(
    '99 Expense rows in 30 records, grouped by Type, with the total of Amount.',
  );
  const t = await lines(page);
  console.log('Amount by Expense type\n' + t.map((r) => r.join(' | ')).join('\n'));
  expect(t.at(-1)).toEqual(['All', '99', '$24,440.53', '$246.87']);
  await summary(page).getByRole('button', { name: 'Lodging' }).click();
  await expect(status(page)).toHaveText('15 of 30 records match Type: Lodging. Show every group');
  await page.getByRole('searchbox', { name: 'Find' }).fill('sterling');
  await expect(status(page)).toHaveText(/^\d+ of 30 records match Find and Type: Lodging\./);
  await page.getByRole('button', { name: 'Show every group' }).click();
  await expect(status(page)).toHaveText(/^\d+ of 30 records match\.$/);
});

test('R2, R9: dates by month; Download CSV in the order shown', async ({ page }) => {
  await open02(page);
  await choose(page, 'Count', 'Expense rows');
  await choose(page, 'Group by', 'Date');
  await choose(page, 'By', 'Month');
  await expect(summary(page).locator('tbody th').first()).toHaveText(/^[A-Z][a-z]+ \d{4}$/);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const d = await dl;
  expect(d.suggestedFilename()).toBe('expense-report-summary.csv');
  const csv = (await import('node:fs')).readFileSync(await d.path(), 'utf8').split('\r\n');
  expect(csv[0]).toBe('Date (month),Count (Expense rows)');
  expect(csv[1]!.split(',')[0]).toBe(await summary(page).locator('tbody th').first().textContent());
});

test('R7: at 390 px the summary fits the width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open02(page);
  await choose(page, 'Group by', 'Department');
  await choose(page, 'Total of', 'Total');
  await expect(summary(page).locator('tfoot th')).toHaveText('All');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(wide).toBeLessThanOrEqual(390);
  const box = await summary(page).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('R10, R11: 5,000 generated records summarize in the Worker; values stay text', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('./');
  const base = bytes(recordPaths('02-expense-report', 1)[0]!).toString('utf8');
  const depts = ['HR', 'FIN', 'IT', 'OPS', 'SAL'];
  const gen = (i: number) => ({
    name: `gen-${String(i).padStart(4, '0')}.xml`,
    mimeType: 'text/xml',
    buffer: Buffer.from(
      base
        .replace(/<my:claimantDept>[^<]*</, `<my:claimantDept>${depts[i % 5]}<`)
        .replace(
          /<my:businessPurpose>[^<]*</,
          `<my:businessPurpose>${i % 2 ? '&lt;img src=x onerror=alert(1)&gt;' : 'Visit'}<`,
        )
        .replace(/<my:totalAmount>[^<]*</, `<my:totalAmount>${((i * 7.31) % 9000).toFixed(2)}<`),
    ),
  });
  const all = Array.from({ length: 5000 }, (_, i) => gen(i + 1));
  await pick(page, [xsnPath('02-expense-report'), ...all.slice(0, 999)]);
  for (let from = 999; from < 5000; from += 1000) {
    await expect(page.locator('.afl-position')).toContainText(`of ${from},`, { timeout: 60_000 });
    await pick(page, all.slice(from, from + 1000));
  }
  await expect(page.locator('.afl-position')).toContainText('of 5000,', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(status(page)).toHaveText('5,000 records.', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Summarize' }).click();
  await choose(page, 'Group by', 'Department');
  await expect(summary(page).locator('caption')).toContainText('5,000 records', {
    timeout: 30_000,
  });
  const worker: string[] = [];
  page.on('console', (m) => m.text().startsWith('R10 summary') && worker.push(m.text()));
  const t0 = Date.now();
  await choose(page, 'Total of', 'Total');
  // The page answers while the Worker works: Find takes typing at once.
  await page.getByRole('searchbox', { name: 'Find' }).fill('visit');
  const typed = Date.now() - t0;
  await expect(summary(page).locator('caption')).toHaveText(
    /^2,500 records, grouped by Department, with the total of Total\./,
    { timeout: 30_000 },
  );
  const ms = Date.now() - t0;
  console.log(`R10: 5,000 records summarized and shown in ${ms} ms (Find typed after ${typed} ms)`);
  console.log(worker.join('; '));
  expect(ms).toBeLessThan(2000);
  await page.getByRole('searchbox', { name: 'Find' }).fill('');
  await choose(page, 'Group by', 'Business purpose');
  await expect(summary(page).locator('tbody th')).toHaveText([
    '<img src=x onerror=alert(1)>',
    'Visit',
  ]);
  expect(await page.locator('.afl-summary img').count()).toBe(0);
});
