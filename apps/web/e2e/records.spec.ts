// Spec 17: the records list. Our own forms and generated records only.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

const status = (page: Page) => page.locator('.afl-records-count');
const bodyRows = (page: Page) => page.locator('.afl-records-table tbody tr[aria-rowindex]');
const header = (page: Page, name: string) =>
  page.locator('.afl-records-table thead th', {
    has: page.getByRole('button', { name, exact: true }),
  });
const column = async (page: Page, name: string) => {
  const names = await page.locator('.afl-records-table thead th').allTextContents();
  const i = names.findIndex((n) => n.replace(/[▲▼]/g, '').trim() === name);
  return bodyRows(page).evaluateAll((rs, i) => rs.map((r) => r.children[i]!.textContent ?? ''), i);
};
const ms = async (what: () => Promise<unknown>) => {
  const t0 = Date.now();
  await what();
  return Date.now() - t0;
};

async function measure(page: Page, total: number, query: string, label: string) {
  const first = await ms(async () => {
    await page.getByRole('button', { name: 'Records', exact: true }).click();
    await expect(bodyRows(page).first()).toBeVisible({ timeout: 30_000 });
  });
  await expect(status(page)).toHaveText(`${total} records.`);
  const find = await ms(async () => {
    await page.getByRole('searchbox', { name: 'Find' }).fill(query);
    await expect(status(page)).toHaveText(/of \d+ records match\./);
  });
  const sort = await ms(async () => {
    await page.getByRole('button', { name: 'Total', exact: true }).click();
    await expect(header(page, 'Total')).toHaveAttribute('aria-sort', 'ascending');
  });
  console.log(`R11 ${label}: first rows ${first} ms, find ${find} ms, sort ${sort} ms`);
  return { first, find, sort };
}

test('R1–R10: find, sort, open, walk, back with the same place, keyboard', async ({ page }) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Expense report/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await expect(page.locator('#afl-records-h')).toBeFocused();
  await expect(page).toHaveTitle(/^Records: /);
  await expect(status(page)).toHaveText('30 records.');
  // Spec 19 R3: Failed checks beside the file name.
  await expect(page.locator('.afl-records-table thead th')).toHaveText([
    'File name',
    'Failed checks',
    'Template version',
    'Name',
    'Employee ID',
    'Department',
    'Business purpose',
    'Currency',
    'Total',
    'Approver e-mail',
    'Expense (rows)',
  ]);
  // R5, R6: Find ignores case and matches any shown value.
  // Spec 19 F1: the list shows the dropdown's name, as the paper does ("Pound sterling", not GBP).
  await page.getByRole('searchbox', { name: 'Find' }).fill('pound');
  const names = await column(page, 'Currency');
  expect(names.length).toBeGreaterThan(1);
  expect(names.length).toBeLessThan(30);
  await expect(status(page)).toHaveText(`${names.length} of 30 records match.`);
  await expect(status(page)).toHaveAttribute('aria-live', 'polite');
  for (const n of await bodyRows(page).allTextContents())
    expect(n.toLowerCase()).toContain('pound');
  // R7: sort by value with the keyboard, then the other way.
  await page.getByRole('button', { name: 'Total', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(header(page, 'Total')).toHaveAttribute('aria-sort', 'ascending');
  const value = (s: string) => Number(s.replace(/[^\d.-]/g, ''));
  const up = (await column(page, 'Total')).map(value);
  expect(up).toEqual([...up].sort((a, b) => a - b));
  await page.keyboard.press('Space');
  await expect(header(page, 'Total')).toHaveAttribute('aria-sort', 'descending');
  const down = (await column(page, 'Total')).map(value);
  expect(down).toEqual([...up].reverse());
  // R8: Enter on the second row's file name opens it; R10: the walk follows the list.
  const files = await column(page, 'File name');
  await page.getByRole('button', { name: files[1]!, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.afl-position')).toHaveText(
    `Record 2 of ${files.length} found, ${files[1]}`,
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.afl-position')).toHaveText(
    `Record 3 of ${files.length} found, ${files[2]}`,
  );
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.locator('.afl-position')).toHaveText(
    `Record 1 of ${files.length} found, ${files[0]}`,
  );
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  // R9: Back restores Find, sort and focus on the record opened.
  await page.goBack();
  await expect(page.getByRole('searchbox', { name: 'Find' })).toHaveValue('pound');
  await expect(header(page, 'Total')).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByRole('button', { name: files[1]!, exact: true })).toBeFocused();
  // A click on a row opens it too.
  await bodyRows(page).nth(2).locator('td').first().click();
  await expect(page.locator('.afl-position')).toHaveText(
    `Record 3 of ${files.length} found, ${files[2]}`,
  );
});

test('R4: Failed checks shows what Fill’s attention line counts', async ({ page }) => {
  await page.goto('./');
  await pick(page, [xsnPath('10-timesheet'), ...recordPaths('10-timesheet', 1)]);
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  const n = Number((await column(page, 'Failed checks'))[0]);
  expect(n).toBeGreaterThan(0);
  await bodyRows(page).first().click();
  await page.getByRole('switch', { name: 'Fill' }).click();
  await expect(page.locator('.afl-attention')).toContainText(`${n} `);
});

test('R11, R12: 30 records and 5,000 generated ones; few rows drawn; values stay text', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Expense report/ })
    .first()
    .click();
  const small = await measure(page, 30, 'kenji', 'form 02, 30 records');

  await page.goto('./');
  const [one] = recordPaths('02-expense-report', 1);
  const base = bytes(one!).toString('utf8');
  const gen = (i: number) => ({
    name: `gen-${String(i).padStart(4, '0')}.xml`,
    mimeType: 'text/xml',
    buffer: Buffer.from(
      base
        .replace(
          /<my:claimantName>[^<]*</,
          `<my:claimantName>${i === 7 ? '&lt;b&gt;Bold&lt;/b&gt;' : `Person ${i}`}<`,
        )
        .replace(/<my:totalAmount>[^<]*</, `<my:totalAmount>${(i * 7.31) % 9000}<`),
    ),
  });
  const all = Array.from({ length: 5000 }, (_, i) => gen(i + 1));
  await pick(page, [xsnPath('02-expense-report'), ...all.slice(0, 999)]);
  for (let from = 999; from < 5000; from += 1000) {
    await expect(page.locator('.afl-position')).toContainText(`of ${from},`, { timeout: 60_000 });
    await pick(page, all.slice(from, from + 1000));
  }
  await expect(page.locator('.afl-position')).toContainText('of 5000,', { timeout: 60_000 });
  const big = await measure(page, 5000, 'person 42', '5,000 generated records');
  expect(await bodyRows(page).count()).toBeLessThan(5000);
  await page.getByRole('searchbox', { name: 'Find' }).fill('');
  await expect(status(page)).toHaveText('5000 records.');
  const drawn = await bodyRows(page).count();
  console.log(`R11: ${drawn} of 5000 rows drawn`);
  expect(drawn).toBeLessThan(200);
  // R12: a value that looks like markup is text.
  await page.getByRole('searchbox', { name: 'Find' }).fill('<b>');
  await expect(status(page)).toHaveText('1 of 5000 records match.');
  await expect(bodyRows(page).first()).toContainText('<b>Bold</b>');
  expect(await page.locator('.afl-records-table b').count()).toBe(0);
  // Typing never waits for the table: each key reaches the box at once.
  const typing = await ms(() =>
    page.getByRole('searchbox', { name: 'Find' }).pressSequentially('xyz'),
  );
  console.log(`R11: 3 keys typed in ${typing} ms`);
  expect(big.find).toBeLessThan(2000);
  expect(big.sort).toBeLessThan(2000);
  expect(small.first).toBeLessThan(5000);
});
