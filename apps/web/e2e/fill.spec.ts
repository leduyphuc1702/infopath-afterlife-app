import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

// Spec 04 tasks 6 and 7: Fill on the paper (R5.2, R5.3, R6.1–R6.4), Download XML and reopen
// (R8.1–R8.3, R11.5), and the cycle time in the Worker (R2.4). The fixture's request guards
// fail the test on any request to another origin.

const E = '/my:expenseClaim[1]';
const AMOUNT = `${E}/my:expenses[1]/my:expense[1]/my:amount[1]`;
const DESCRIPTION = `${E}/my:expenses[1]/my:expense[1]/my:expenseDescription[1]`;
const TOTAL = `${E}/my:totalAmount[1]`;
const NAME = `${E}/my:claimant[1]/my:claimantName[1]`;

const at = (page: Page, path: string) =>
  page.locator(`[data-afl-paper] [data-afl-path="${path}"]`).first();
const fillSwitch = (page: Page) => page.getByRole('switch', { name: 'Fill' });
const renders = (page: Page) =>
  page.locator('[data-afl-paper]').getAttribute('data-afl-renders').then(Number);
const activePath = (page: Page) =>
  page.evaluate(
    () =>
      (document.querySelector('[data-afl-paper]')?.shadowRoot?.activeElement as HTMLElement | null)
        ?.dataset.aflPath,
  );

/** Types into a text box and commits with `key`; waits for the render that follows. */
async function type(page: Page, box: Locator, text: string, key: 'Enter' | 'Tab' = 'Enter') {
  const before = await renders(page);
  await box.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await page.keyboard.press(key);
  await expect.poll(() => renders(page)).toBeGreaterThan(before);
}

/** Opens a sample on its empty form (a sample opens on its first record) and turns Fill on. */
async function openFill(page: Page, sample: RegExp) {
  await page.goto('./');
  await page.getByRole('button', { name: sample }).click();
  await expect(page.locator('.afl-root')).toBeVisible();
  const previous = page.getByRole('button', { name: 'Previous' });
  if (await previous.isEnabled()) await previous.click();
  await expect(page.locator('.afl-position')).toHaveText('Empty form');
  await fillSwitch(page).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-afl-paper][data-afl-renders]')).toBeVisible();
}

test('form 02: type amounts, Total follows, focus stays, a blank name is marked', async ({
  page,
}) => {
  await openFill(page, /^Expense report/);
  await expect(page.locator('.afl-status')).toHaveText(
    'Filling in this form. Nothing is saved until you choose Download XML.',
  );
  // R5.2: the empty required name is marked at once, with its message.
  await expect(at(page, NAME)).toHaveClass(/afl-invalid/);
  await expect(at(page, NAME)).toHaveAttribute('aria-invalid', 'true');
  await expect(at(page, NAME)).toHaveAttribute('title', 'Cannot be blank');
  await expect(page.locator('.afl-attention')).toContainText('need attention');

  // Commit with Tab: Total updates, and focus has moved on, not back.
  const y = await page.evaluate(() => scrollY);
  await type(page, at(page, AMOUNT), '12.5', 'Tab');
  await expect(at(page, TOTAL)).toHaveText('$12.50');
  expect(await activePath(page)).not.toBe(AMOUNT);
  // Tab order: the row's controls, then its menu button (spec 04 task 9), then the next control.
  expect(
    await page.evaluate(() =>
      document
        .querySelector('[data-afl-paper]')
        ?.shadowRoot?.activeElement?.getAttribute('aria-label'),
    ),
  ).toBe('Actions for row 1 of Expenses');
  expect(await page.evaluate(() => scrollY)).toBe(y);

  // Commit with Enter: focus and caret stay in the box, so typing goes on where it was.
  await type(page, at(page, DESCRIPTION), 'Taxi');
  expect(await activePath(page)).toBe(DESCRIPTION);
  const before = await renders(page);
  await page.keyboard.type(' ride');
  await page.keyboard.press('Enter');
  await expect.poll(() => renders(page)).toBeGreaterThan(before);
  await expect(at(page, DESCRIPTION)).toHaveText('Taxi ride');

  // The form's own rule fires, and clears when fixed.
  await type(page, at(page, AMOUNT), '-5');
  await expect(at(page, AMOUNT)).toHaveAttribute('title', 'Must be > 0');
  await type(page, at(page, AMOUNT), '20');
  await expect(at(page, AMOUNT)).not.toHaveClass(/afl-invalid/);
  await expect(at(page, TOTAL)).toHaveText('$20.00');
  await type(page, at(page, NAME), 'Ivo Corvin');
  await expect(at(page, NAME)).not.toHaveClass(/afl-invalid/);

  // R6.2: read-only controls say so, to hover and to screen readers.
  await expect(at(page, TOTAL)).toHaveAttribute('aria-readonly', 'true');
  await expect(at(page, TOTAL)).toHaveAttribute('aria-description', /Worked out from other fields/);
  const receipt = at(page, `${E}/my:expenses[1]/my:expense[1]/my:receipt[1]`);
  await expect(receipt).toHaveAttribute(
    'aria-description',
    "This control can't be edited in the viewer.",
  );

  // R6.4: X-ray still outlines a control on hover.
  await page.getByRole('button', { name: 'X-ray' }).click();
  await at(page, TOTAL).hover();
  await expect(page.locator('.afl-outline').first()).toBeVisible();
});

test('form 02: Download XML, drop it back, the same values; nothing stored', async ({ page }) => {
  await openFill(page, /^Expense report/);
  await type(page, at(page, NAME), 'Mara Quill');
  await type(page, at(page, AMOUNT), '41.25');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download XML' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('02-expense-report-new.xml');
  const xml = bytes(await download.path()).toString('utf8');
  expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<\?mso-infoPathSolution /);
  expect(xml).toContain('<my:claimantName>Mara Quill</my:claimantName>');
  expect(xml).toContain('<my:totalAmount>41.25</my:totalAmount>');
  await expect(page.locator('.afl-status')).toContainText('Downloaded 02-expense-report-new.xml.');
  // Downloaded: turning Fill off does not ask.
  await fillSwitch(page).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'false');

  await pick(page, [
    { name: download.suggestedFilename(), mimeType: 'text/xml', buffer: Buffer.from(xml) },
  ]);
  const position = page.locator('.afl-position');
  await expect(position).toContainText('of 31');
  for (let i = 0; i < 31 && !(await position.textContent())?.includes('-new.xml'); i++)
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(position).toContainText('02-expense-report-new.xml');
  await expect(at(page, NAME)).toHaveText('Mara Quill');
  await expect(at(page, TOTAL)).toHaveText('$41.25');

  // R8.3: nothing in storage.
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
});

test('leaving Fill with changes asks in a dialog; Back and Forward keep the session', async ({
  page,
}) => {
  await openFill(page, /^Expense report/);
  await type(page, at(page, AMOUNT), '7');
  await fillSwitch(page).click();
  const dialog = page.getByRole('dialog', { name: 'Discard your changes?' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'true');

  // The pager asks too.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Keep filling' }).click();
  await expect(page.locator('.afl-position')).toHaveText('Empty form');

  // Leaving the form screen keeps the session: open a second sample, go to Triage, then Back.
  await page.locator('.afl-header .afl-menu summary').click();
  await page.locator('.afl-header .afl-menu li button', { hasText: /^Leave request\d/ }).click();
  await expect(page.locator('.afl-form-name')).toHaveText(/Leave/);
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await page.goBack();
  await expect(page.locator('.afl-form-name')).toHaveText('Expense Report');
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(at(page, TOTAL)).toHaveText('$7.00');
  await page.goForward();
  await expect(page.locator('.afl-form-name')).toHaveText(/Leave/);
  await page.goBack();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'true');

  // Printing in Fill mode prints the filled paper (spec 13 B1).
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-afl-paper]')).toBeVisible();
  await expect(at(page, TOTAL)).toHaveText('$7.00');
  await expect(page.locator('.afl-attention')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await fillSwitch(page).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'false');
});

test('form 10: a record breaking its own rules is marked at once; empty totals are worked out', async ({
  page,
}) => {
  await page.goto('./');
  await pick(page, [xsnPath('10-timesheet'), ...recordPaths('10-timesheet', 1)]);
  await expect(page.locator('.afl-position')).toContainText('Record 1 of 1');
  await fillSwitch(page).click();
  await expect(page.locator('[data-afl-paper] .afl-invalid').first()).toHaveAttribute(
    'title',
    'Max 24',
  );
  await expect(page.locator('.afl-status')).toContainText(
    '1 calculated field was empty in this record and has been worked out.',
  );
  // Not an unsaved change: Fill turns off without asking.
  await fillSwitch(page).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'false');
});

test('a record of another version cannot be filled, and says why', async ({ page }) => {
  await page.goto('./');
  // A form 02 record, its version changed here in memory: same template, another version.
  const [path] = recordPaths('02-expense-report', 1);
  const xml = bytes(path!)
    .toString('utf8')
    .replace(/solutionVersion="[^"]+"/, 'solutionVersion="0.9.0.1"');
  await pick(page, [
    xsnPath('02-expense-report'),
    { name: 'old-version.xml', mimeType: 'text/xml', buffer: Buffer.from(xml) },
  ]);
  await expect(page.locator('.afl-badge')).toContainText('Made with version 0.9.0.1');
  await expect(fillSwitch(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(fillSwitch(page)).toHaveAttribute(
    'aria-description',
    /records made with this version/,
  );
  await fillSwitch(page).dispatchEvent('click');
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'false');
});

// R2.4: one cycle in the Worker, edit in to render out, over 20 commits; p95 nearest-rank.
for (const [sample, label] of [
  [/^Purchase request/, 'form 04'],
  [/^Big form/, 'form 08'],
] as const)
  test(`R2.4: Worker cycle time on ${label}`, async ({ page }) => {
    await openFill(page, sample);
    const box = page.locator('[data-afl-paper] [data-afl-edit="PlainText"]').first();
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      await type(page, box, String(10 + (i % 7)) + (i % 2 ? '' : '.5'));
      times.push(Number(await page.locator('[data-afl-paper]').getAttribute('data-afl-cycle-ms')));
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.ceil(0.95 * times.length) - 1]!;
    console.log(`R2.4 Worker ${label}: p50 ${times[9]!.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`);
    // R2.4: the 30 ms budget is for forms under 200 fields (form 04); form 08 is reported (E2).
    if (label === 'form 04') expect(p95).toBeLessThan(30);
  });

// Spec 04 task 9 (R7.1–R7.3): rows and optional sections, by mouse and by keyboard.
const ROW = (n: number) => `${E}/my:expenses[1]/my:expense[${n}]`;
const activeNode = (page: Page) =>
  page.evaluate(() => {
    const a = document.querySelector('[data-afl-paper]')?.shadowRoot?.activeElement;
    return a?.closest<HTMLElement>('[data-afl-structure]')?.dataset.aflNode;
  });

test('form 02: Insert item, the row menu by keyboard, Total follows, focus moves with the rows', async ({
  page,
}) => {
  await openFill(page, /^Expense report/);
  // The empty form has one empty expense row.
  const rows = page.locator('[data-afl-paper] [data-afl-structure="row"]');
  await expect(rows).toHaveCount(1);
  const before = await renders(page);
  await page.getByRole('button', { name: 'Insert a row at the end of Expenses' }).click();
  await expect.poll(() => renders(page)).toBeGreaterThan(before);
  await expect(rows).toHaveCount(2);
  // Focus is in the new row's first control.
  expect(await activePath(page)).toBe(`${ROW(2)}/my:expenseDate[1]`);
  await type(page, at(page, `${ROW(2)}/my:amount[1]`), '30');
  await expect(at(page, TOTAL)).toHaveText('$30.00');

  // Keyboard: the row's menu button, Enter, ArrowDown to "Insert below", Enter.
  await page.getByRole('button', { name: 'Actions for row 2 of Expenses' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: 'Actions for row 2 of Expenses' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: 'Insert a row below row 2 of Expenses' }),
  ).toBeFocused();
  let n = await renders(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(rows).toHaveCount(3);
  expect(await activeNode(page)).toBe(ROW(3));
  await type(page, at(page, `${ROW(3)}/my:amount[1]`), '12');
  await expect(at(page, TOTAL)).toHaveText('$42.00');

  // Remove row 2: row 3 takes its place and gets the focus; Total follows.
  await page.getByRole('button', { name: 'Actions for row 2 of Expenses' }).click();
  n = await renders(page);
  await page.getByRole('menuitem', { name: 'Remove row 2 of Expenses' }).click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(rows).toHaveCount(2);
  expect(await activeNode(page)).toBe(ROW(2));
  await expect(at(page, TOTAL)).toHaveText('$12.00');
  await expect(at(page, `${ROW(2)}/my:amount[1]`)).toHaveText('$12.00');

  // Removing the last rows puts focus on "Insert item".
  for (const k of [2, 1]) {
    await page.getByRole('button', { name: `Actions for row ${k} of Expenses` }).click();
    n = await renders(page);
    await page.getByRole('menuitem', { name: `Remove row ${k} of Expenses` }).click();
    await expect.poll(() => renders(page)).toBeGreaterThan(n);
  }
  await expect(rows).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Insert a row at the end of Expenses' }),
  ).toBeFocused();
  await expect(at(page, TOTAL)).toHaveText('$0.00');
  // A row change is an unsaved change.
  await fillSwitch(page).click();
  await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes' }).click();
});

test('form 05: the optional Relocation section inserts and removes', async ({ page }) => {
  await openFill(page, /^New hire onboarding/);
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Manager' });
  const insert = page.getByRole('button', { name: 'Insert Relocation' });
  await expect(insert).toBeVisible();
  await insert.focus();
  await page.keyboard.press('Enter');
  const section = page.locator('[data-afl-paper] [data-afl-structure="optional"]');
  await expect(section).toHaveCount(1);
  expect(await activeNode(page)).toBe('/my:onboarding[1]/my:relocation[1]');
  await page.getByRole('button', { name: 'Actions for Relocation' }).click();
  await page.getByRole('menuitem', { name: 'Remove Relocation' }).click();
  await expect(section).toHaveCount(0);
  await expect(insert).toBeFocused();
});
