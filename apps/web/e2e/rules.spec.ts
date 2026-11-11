import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Spec 04 tasks 10–12: buttons and rule dialogs (R4), the Rule Trace tab (R9), undo and redo
// (R10.1). Samples open on their first record.

const P = '/my:purchaseRequest[1]';
const LINE = `${P}/my:lines[1]/my:line[1]`;
const E = '/my:expenseClaim[1]';
const AMOUNT = `${E}/my:expenses[1]/my:expense[1]/my:amount[1]`;
const TOTAL = `${E}/my:totalAmount[1]`;

const at = (page: Page, path: string) =>
  page.locator(`[data-afl-paper] [data-afl-path="${path}"]`).first();
const fillSwitch = (page: Page) => page.getByRole('switch', { name: 'Fill' });
const renders = (page: Page) =>
  page.locator('[data-afl-paper]').getAttribute('data-afl-renders').then(Number);
const active = (page: Page) =>
  page.evaluate(() => {
    const a = document.querySelector('[data-afl-paper]')?.shadowRoot?.activeElement as
      HTMLElement | null | undefined;
    return {
      path: a?.dataset.aflPath,
      button: a?.dataset.aflButton,
      structure: a?.dataset.aflStructure,
    };
  });

async function open(page: Page, sample: RegExp, empty = false) {
  await page.goto('./');
  await page.getByRole('button', { name: sample }).click();
  await expect(page.locator('.afl-root')).toBeVisible();
  if (empty) {
    const previous = page.getByRole('button', { name: 'Previous' });
    if (await previous.isEnabled()) await previous.click();
    await expect(page.locator('.afl-position')).toHaveText('Empty form');
  }
}

async function fillOn(page: Page) {
  await fillSwitch(page).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-afl-paper][data-afl-renders]')).toBeVisible();
}

async function type(page: Page, path: string, text: string) {
  const before = await renders(page);
  await at(page, path).click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await expect.poll(() => renders(page)).toBeGreaterThan(before);
}

test('form 04: buttons are inactive outside Fill; "Check approval" opens a real dialog', async ({
  page,
}) => {
  await open(page, /^Purchase request/);
  const approval = page.locator('[data-afl-paper] input[value="Check approval"]');
  await expect(approval).toBeVisible();
  // Outside Fill the paper is inert and its buttons are drawn faded.
  await expect(page.locator('[data-afl-paper] .afl-root')).toHaveAttribute('inert', '');
  await expect(approval).toHaveCSS('opacity', '0.5');

  await fillOn(page);
  await expect(approval).toHaveCSS('opacity', '1');
  await approval.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Message from the form' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Total 1566.33 is over 1000: accounting must approve.');
  await expect(dialog.getByRole('button', { name: 'OK' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect((await active(page)).button).toBe('CTRL901');

  // "Check budget": the query is skipped, said in the Rule Trace; no dialog, no change.
  const budget = await at(page, `${P}/my:budgetRemaining[1]`).textContent();
  await page.locator('[data-afl-paper] input[value="Check budget"]').click();
  await page.getByRole('tab', { name: 'Rule Trace' }).click();
  await expect(
    page.getByText(
      'Rule “Query budget service” did not query a data connection. Query connections are not available in the viewer.',
    ),
  ).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(at(page, `${P}/my:budgetRemaining[1]`)).toHaveText(budget ?? '');
});

test('form 05: the view buttons switch views in Fill mode', async ({ page }) => {
  await open(page, /^New hire onboarding/, true);
  await fillOn(page);
  const select = page.getByRole('combobox', { name: 'View' });
  const button = (id: string) => page.locator(`[data-afl-paper] [data-afl-button="${id}"]`);
  await expect(select).toHaveValue('HR');
  await button('CTRL910').click();
  await expect(select).toHaveValue('IT');
  await button('CTRL912').click();
  await expect(select).toHaveValue('HR');
  await button('CTRL911').click();
  await expect(select).toHaveValue('Manager');
});

test('form 04: Rule Trace shows the chain in order, outlines on hover, filters by field', async ({
  page,
}) => {
  await open(page, /^Purchase request/, true);
  // Before Fill there is no Rule Trace tab.
  await expect(page.getByRole('tab', { name: 'Rule Trace' })).toHaveCount(0);
  await fillOn(page);
  await page.getByRole('tab', { name: 'Rule Trace' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Rule Trace' });
  await type(page, `${LINE}/my:unitPrice[1]`, '100');
  await type(page, `${LINE}/my:quantity[1]`, '3');
  const list = panel.getByRole('list', { name: 'Rule Trace entries' });
  // Newest first: the last four entries of the quantity edit, read bottom-up.
  const texts = (await list.getByRole('listitem').allInnerTexts()).slice(0, 4).reverse();
  expect(
    texts.map((t) => t.replace(/^\d\d:\d\d:\d\d /, '').replace(/\nShow expression$/, '')),
  ).toEqual([
    'Line total in row 1 changed from 0 to 300 because Qty in row 1 changed.',
    'Subtotal changed from 0 to 300 because Line total in row 1 changed.',
    expect.stringMatching(/^VAT changed from [\d.]+ to [\d.]+ because Subtotal changed\.$/),
    expect.stringMatching(
      /^Total incl\. VAT changed from [\d.]+ to [\d.]+ because Subtotal changed\.$/,
    ),
  ]);
  // The expression is there on demand.
  const subtotal = list
    .getByRole('listitem')
    .filter({ hasText: /^.{0,12}Subtotal changed from 0/ });
  await subtotal.getByText('Show expression').click();
  await expect(subtotal.locator('code')).toHaveText(
    'sum(xdMath:Nz(../my:lines/my:line/my:lineTotal))',
  );
  // Hover outlines the field on the paper.
  await subtotal.hover();
  await expect(at(page, `${P}/my:subtotal[1]`)).toHaveClass(/afl-traced/);
  await page.getByRole('tab', { name: 'Rule Trace' }).hover();
  await expect(at(page, `${P}/my:subtotal[1]`)).not.toHaveClass(/afl-traced/);
  // Focus does the same, for the keyboard.
  await subtotal.focus();
  await expect(at(page, `${P}/my:subtotal[1]`)).toHaveClass(/afl-traced/);
  // The filter keeps the entries of one field: Subtotal's changes and what they caused.
  const all = await list.getByRole('listitem').count();
  await panel.getByRole('combobox', { name: 'Show' }).selectOption({ label: 'Subtotal' });
  await expect(
    panel.getByText(new RegExp(`^\\d+ of ${all} entries, newest first\\.$`)),
  ).toBeVisible();
  const kept = await list.getByRole('listitem').allInnerTexts();
  expect(kept.length).toBeGreaterThanOrEqual(3);
  expect(kept.length).toBeLessThan(all);
  for (const t of kept) expect(t).toContain('Subtotal');
});

test('Rule Trace empty state says what appears and how', async ({ page }) => {
  await open(page, /^New hire onboarding/, true);
  await fillOn(page);
  await page.getByRole('tab', { name: 'Rule Trace' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Rule Trace' })).toHaveText(
    'Each rule, calculation and check that runs while you fill in the form appears here, with why it ran. Change a field or press a button in the form to see it.',
  );
});

test('form 02: undo and redo by toolbar and keys; a row insert is one step, focus goes back', async ({
  page,
}) => {
  await open(page, /^Expense report/, true);
  await fillOn(page);
  const undo = page.getByRole('button', { name: /^Undo \((Ctrl|Cmd)\+Z\)$/ });
  const redo = page.getByRole('button', { name: /^Redo \(Shift\+(Ctrl|Cmd)\+Z\)$/ });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await type(page, AMOUNT, '30');
  await type(page, AMOUNT, '45');
  await expect(at(page, TOTAL)).toHaveText('$45.00');
  await undo.click();
  await expect(at(page, TOTAL)).toHaveText('$30.00');
  await expect(redo).toBeEnabled();
  // Spec 14 B6: focus goes to the field the step changed, not the toolbar.
  expect((await active(page)).path).toBe(AMOUNT);
  await undo.click();
  await expect(at(page, TOTAL)).toHaveText('$0.00');
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(at(page, TOTAL)).toHaveText('$30.00');
  // A new command clears redo.
  await type(page, AMOUNT, '7');
  await expect(redo).toBeDisabled();
  await expect(at(page, TOTAL)).toHaveText('$7.00');

  // A row insert is one step; undoing it by key puts focus back on "Insert item".
  const rows = page.locator('[data-afl-paper] [data-afl-structure="row"]');
  const insert = page.getByRole('button', { name: 'Insert item: a row at the end of Expenses' });
  await insert.focus();
  await page.keyboard.press('Enter');
  await expect(rows).toHaveCount(2);
  let n = await renders(page);
  await page.keyboard.press('ControlOrMeta+Z');
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(rows).toHaveCount(1);
  expect((await active(page)).structure).toBe('insert');
  await expect(at(page, TOTAL)).toHaveText('$7.00');
  n = await renders(page);
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(rows).toHaveCount(2);
  // Typing not yet committed is the browser's to undo, not a whole command.
  await at(page, AMOUNT).click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('99');
  n = await renders(page);
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await renders(page)).toBe(n);
  await expect(rows).toHaveCount(2);
});
