// The library: the forms this browser keeps between visits, new records saved into them, forms and
// records removed after a question, and the whole of it backed up as one .zip.
// Not written by Kiro (README, "What Kiro did not write").
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

const E = '/my:expenseClaim[1]';
const NAME = `${E}/my:claimant[1]/my:claimantName[1]`;
const AMOUNT = `${E}/my:expenses[1]/my:expense[1]/my:amount[1]`;
const TOTAL = `${E}/my:totalAmount[1]`;

const at = (page: Page, path: string) =>
  page.locator(`[data-afl-paper] [data-afl-path="${path}"]`).first();
const renders = (page: Page) =>
  page.locator('[data-afl-paper]').getAttribute('data-afl-renders').then(Number);
const rows = (page: Page) => page.locator('.afl-lib-table tbody tr');
const status = (page: Page) => page.locator('.afl-status');
const position = (page: Page) => page.locator('.afl-position');
const home = (page: Page) =>
  page.getByRole('link', { name: 'InfoPath Afterlife', exact: true }).click();

async function type(page: Page, box: Locator, text: string) {
  const before = await renders(page);
  await box.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await expect.poll(() => renders(page)).toBeGreaterThan(before);
}

/** Answers the question a removal asks. */
async function remove(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('an empty library asks for files; files added are there on the next visit', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();
  await expect(page.locator('.afl-dropzone')).toBeVisible();
  await expect(page.locator('.afl-lib-table')).toHaveCount(0);

  await pick(page, [xsnPath('02-expense-report'), ...recordPaths('02-expense-report', 3)]);
  await expect(position(page)).toContainText('Record 1 of 3');

  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  const row = rows(page).first();
  await expect(row.getByRole('rowheader')).toContainText('Expense Report');
  await expect(row.getByRole('rowheader')).toContainText('02-expense-report.xsn, version 1.0.0.1');
  // The person's own file: not marked as a sample.
  await expect(row.locator('.afl-lib-tag')).toHaveCount(0);
  await expect(page.locator('.afl-lead')).toContainText(
    '1 form and 3 records, kept in this browser.',
  );
  await expect(page.locator('.afl-dropzone')).toHaveCount(0);
  // The tasks and samples stay under the table.
  await expect(page.getByRole('heading', { name: 'Start with a task' })).toBeVisible();

  // The count leads to the records; the name opens the form, empty, with its records one step on.
  await row.getByRole('button', { name: '3 records of Expense Report' }).click();
  await expect(page.locator('.afl-records-table tbody tr')).toHaveCount(3);
  await home(page);
  await rows(page).first().getByRole('button', { name: 'Expense Report', exact: true }).click();
  await expect(page.locator('.afl-form-name')).toHaveText('Expense Report');
  await expect(position(page)).toHaveText('Empty form');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(position(page)).toContainText('Record 1 of 3, 02-expense-report-001.xml');
});

test('New record, Save: the record joins the library and is there on the next visit', async ({
  page,
}) => {
  await page.goto('./');
  await pick(page, [xsnPath('02-expense-report')]);
  await expect(page.locator('.afl-form-name')).toHaveText('Expense Report');
  await home(page);
  await expect(rows(page).first()).toContainText('None yet');

  await page.getByRole('button', { name: 'New record in Expense Report' }).click();
  await expect(page.getByRole('switch', { name: 'Fill' })).toHaveAttribute('aria-checked', 'true');
  await expect(status(page)).toHaveText(
    'Filling in this form. Nothing is kept until you choose Save.',
  );
  await type(page, at(page, NAME), 'Mara Quill');
  await type(page, at(page, AMOUNT), '41.25');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(status(page)).toHaveText(
    /^Saved as 02-expense-report-\d{4}-\d\d-\d\d-\d{6}\.xml, a new record in your library\./,
  );
  await expect(position(page)).toContainText('Record 1 of 1, 02-expense-report-');

  // Saved once: a change saved again goes into the same record, by the keyboard too.
  await type(page, at(page, AMOUNT), '50');
  await page.keyboard.press('ControlOrMeta+S');
  await expect(status(page)).toHaveText(/^Saved 02-expense-report-\d{4}-\d\d-\d\d-\d{6}\.xml\./);
  await expect(position(page)).toContainText('Record 1 of 1,');

  // Nothing unsaved: leaving does not ask.
  await home(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '1 record of Expense Report' })).toBeVisible();

  await page.reload();
  await rows(page).first().getByRole('button', { name: 'Expense Report', exact: true }).click();
  await expect(position(page)).toHaveText('Empty form');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(position(page)).toContainText('Record 1 of 1,');
  await expect(at(page, NAME)).toHaveText('Mara Quill');
  await expect(at(page, TOTAL)).toHaveText('$50.00');
});

test('changes that were not saved are asked about, and Save keeps them', async ({ page }) => {
  await page.goto('./');
  await pick(page, [xsnPath('02-expense-report')]);
  await expect(page.locator('.afl-form-name')).toHaveText('Expense Report');
  await home(page);
  await page.getByRole('button', { name: 'New record in Expense Report' }).click();
  await type(page, at(page, NAME), 'Ines Vale');
  await home(page);
  const dialog = page.getByRole('dialog', { name: 'Discard your changes?' });
  await expect(dialog).toContainText(
    "You changed this form and haven't saved it. The changes will be lost.",
  );
  await dialog.getByRole('button', { name: 'Keep filling' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(status(page)).toContainText('a new record in your library.');
  await home(page);
  await expect(page.getByRole('button', { name: '1 record of Expense Report' })).toBeVisible();
});

test('Remove asks first; the form leaves with its records and stays gone', async ({ page }) => {
  await page.goto('./');
  await pick(page, [
    xsnPath('01-leave-request'),
    xsnPath('02-expense-report'),
    ...recordPaths('02-expense-report', 3),
  ]);
  await expect(page.locator('#afl-triage-h')).toBeVisible();
  await home(page);
  await expect(rows(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Remove Expense Report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove Expense Report?' });
  await expect(dialog).toContainText(
    'Expense Report and 3 records will leave the library in this browser. Files on your computer are not touched.',
  );
  // The safe answer has the focus, and Escape gives it.
  await expect(dialog.getByRole('button', { name: 'Keep' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rows(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Remove Expense Report' }).click();
  await remove(page, 'Remove Expense Report?');
  await expect(rows(page)).toHaveCount(1);
  await expect(status(page)).toHaveText('Removed Expense Report and 3 records from the library.');
  await expect(page.locator('.afl-lead')).toContainText('1 form and 0 records');

  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().getByRole('rowheader')).toContainText('Leave Request');
});

test('a record leaves by its own button, and the pager stays inside the rest', async ({ page }) => {
  await page.goto('./');
  await pick(page, [xsnPath('02-expense-report'), ...recordPaths('02-expense-report', 3)]);
  await expect(position(page)).toContainText('Record 1 of 3, 02-expense-report-001.xml');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(position(page)).toContainText('Record 3 of 3, 02-expense-report-003.xml');

  await page.getByRole('button', { name: 'Remove this record' }).click();
  await remove(page, 'Remove 02-expense-report-003.xml?');
  await expect(status(page)).toHaveText('Removed 02-expense-report-003.xml from the library.');
  await expect(position(page)).toContainText('Record 2 of 2, 02-expense-report-002.xml');

  await page.reload();
  await expect(page.getByRole('button', { name: '2 records of Expense Report' })).toBeVisible();
});

test('Back up saves one .zip; dropped on an empty library it brings everything back', async ({
  page,
}) => {
  await page.goto('./');
  await pick(page, [xsnPath('02-expense-report'), ...recordPaths('02-expense-report', 3)]);
  await expect(position(page)).toContainText('Record 1 of 3');
  await home(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Back up' }).click(),
  ]);
  const name = download.suggestedFilename();
  expect(name).toMatch(/^infopath-afterlife-library-\d{4}-\d\d-\d\d\.zip$/);
  await expect(status(page)).toHaveText(
    `Saved ${name}: 1 form and 3 records. Drop it on this page to bring the library back.`,
  );
  const zip = bytes(await download.path());

  await page.getByRole('button', { name: 'Remove Expense Report' }).click();
  await remove(page, 'Remove Expense Report?');
  await expect(page.locator('.afl-dropzone')).toBeVisible();

  await pick(page, [{ name, mimeType: 'application/zip', buffer: zip }]);
  await expect(position(page)).toContainText('Record 1 of 3, 02-expense-report-001.xml');
  await home(page);
  await expect(page.locator('.afl-lead')).toContainText('1 form and 3 records');
});

test('a sample is marked as one, and the samples leave together', async ({ page }) => {
  await page.goto('./');
  await page.locator('.afl-samples button', { hasText: /^Leave request\s*30/ }).click();
  await expect(page.locator('.afl-form-name')).toHaveText('Leave Request');
  await home(page);
  await page.locator('.afl-samples button', { hasText: /^Expense report/ }).click();
  await expect(page.locator('.afl-form-name')).toHaveText('Expense Report');
  await home(page);
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('.afl-lib-tag')).toHaveText(['Sample', 'Sample']);

  await page.getByRole('button', { name: 'Remove the 2 sample forms' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove 2 forms?' });
  await expect(dialog).toContainText('2 forms and 60 records will leave the library');
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.afl-dropzone')).toBeVisible();
  await page.reload();
  await expect(page.locator('.afl-dropzone')).toBeVisible();
});

test('a record without its form is listed above the library and can be removed', async ({
  page,
}) => {
  await page.goto('./');
  await pick(page, recordPaths('02-expense-report', 1));
  const panel = page.getByRole('region', { name: /Records not matched/ });
  await expect(panel).toContainText('Records not matched (1)');
  await page.reload();
  await expect(panel).toContainText('02-expense-report-001.xml');
  await panel.getByRole('button', { name: 'Remove it from the library' }).click();
  await remove(page, 'Remove 1 record?');
  await expect(panel).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.afl-dropzone')).toBeVisible();
  await expect(panel).toHaveCount(0);
});

test('from nine forms on, a box finds one by its name or its file', async ({ page }) => {
  await page.goto('./');
  await page.locator('.afl-triage-all .afl-button').click();
  await expect(page.locator('#afl-triage-h')).toBeVisible();
  await home(page);
  await expect(rows(page)).toHaveCount(48);
  const find = page.getByRole('searchbox', { name: 'Find a form' });
  await find.fill('leave');
  await expect(rows(page)).toHaveCount(3);
  await find.fill('02-EXPENSE');
  await expect(rows(page)).toHaveCount(1);
  await find.fill('no such form');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('.afl-lib-none')).toHaveText('No form has “no such form”.');
});

test('at 390 px each form is a block, and still a row of a table to a screen reader', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await pick(page, [xsnPath('02-expense-report'), ...recordPaths('02-expense-report', 3)]);
  await expect(position(page)).toContainText('Record 1 of 3');
  await home(page);
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  const row = table.getByRole('row', { name: /Expense Report/ });
  await expect(row.getByRole('rowheader')).toContainText('Expense Report');
  await expect(row.getByRole('cell')).toHaveCount(3);
  for (const name of ['New record in Expense Report', 'Remove Expense Report']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the product name leads back to the library', async ({ page }) => {
  await page.goto('./#read');
  await expect(position(page)).toContainText('02-expense-report-001.xml');
  await home(page);
  await expect(page.locator('#afl-library-h')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Start with a task' })).toBeVisible();
  await expect(page).not.toHaveURL(/#/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(position(page)).toContainText('02-expense-report-001.xml');
});

test('Back from a task returns to the task list, not to the top of the page', async ({ page }) => {
  await page.goto('./');
  await page.locator('.afl-tasks a[href="#fill"]').click();
  await expect(page.getByRole('switch', { name: 'Fill' })).toBeVisible();
  await page.goBack();
  const heading = page.locator('#afl-tasks-h');
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect(page.locator('.afl-tasks a[href="#find"]')).toBeInViewport();
  const bar = (await page.locator('.afl-header').boundingBox())!;
  expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
});

for (const width of [320, 390, 820, 1280, 1920]) {
  test(`at ${width} px the library fits its width, empty and full, light and dark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const fits = async () => {
      await expect(page.locator('html[data-ready]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    };
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('./');
      await fits();
    }
    // Nine forms: the table, its find box and the tools above it.
    await page.locator('.afl-triage-all .afl-button').click();
    await expect(page.locator('#afl-triage-h')).toBeVisible();
    await home(page);
    await expect(rows(page)).toHaveCount(48);
    await fits();
  });
}

test('Triage draws its waves as one bar, in the shares its sentence gives', async ({ page }) => {
  await page.goto('./#triage');
  const triage = page.getByRole('region', { name: 'Triage' });
  await expect(triage).toContainText('48 forms, wave 1: 23, wave 2: 17, wave 3: 8.');
  const bar = triage.locator('.afl-wave-bar');
  // Decoration: the sentence under it carries the numbers.
  await expect(bar).toHaveAttribute('aria-hidden', 'true');
  expect(
    await bar
      .locator('i')
      .evaluateAll((parts) =>
        parts.map((p) => [(p as HTMLElement).dataset.wave, getComputedStyle(p).flexGrow]),
      ),
  ).toEqual([
    ['1', '23'],
    ['2', '17'],
    ['3', '8'],
  ]);
});
