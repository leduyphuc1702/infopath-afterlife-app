import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Spec 14: one regression test per Fill-mode bug, each written to fail on the code before its
// fix (commit 70f873f). B4 and B8 also have unit tests in core and in the web package.

const E = '/my:expenseClaim[1]';
const AMOUNT = `${E}/my:expenses[1]/my:expense[1]/my:amount[1]`;
const P = '/my:purchaseRequest[1]';
const QTY = `${P}/my:lines[1]/my:line[1]/my:quantity[1]`;

const at = (page: Page, path: string) =>
  page.locator(`[data-afl-paper] [data-afl-path="${path}"]`).first();
const fillSwitch = (page: Page) => page.getByRole('switch', { name: 'Fill' });
const renders = (page: Page) =>
  page.locator('[data-afl-paper]').getAttribute('data-afl-renders').then(Number);
const paperFocus = (page: Page) =>
  page.evaluate(() => {
    const a = document.querySelector('[data-afl-paper]')?.shadowRoot?.activeElement as
      HTMLElement | null | undefined;
    return a ? (a.dataset.aflPath ?? a.dataset.aflButton ?? a.tagName) : undefined;
  });

/** Opens a sample on its first record (or the empty form) and turns Fill on. */
async function open(page: Page, sample: RegExp, empty = false) {
  await page.goto('./');
  await page.getByRole('button', { name: sample }).click();
  await expect(page.locator('.afl-root')).toBeVisible();
  if (empty) {
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.locator('.afl-position')).toHaveText('Empty form');
  }
  await fillSwitch(page).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-afl-paper][data-afl-renders]')).toBeVisible();
}

async function type(page: Page, path: string, text: string) {
  const n = await renders(page);
  await at(page, path).click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
}

test('B1: the row menu is drawn whole, above the table cell', async ({ page }) => {
  await open(page, /^Expense report/);
  await page.getByRole('button', { name: 'Actions for row 2 of Expenses' }).click();
  const hits = await page.evaluate(() => {
    const root = document.querySelector('[data-afl-paper]')!.shadowRoot!;
    return [...root.querySelectorAll<HTMLElement>('.afl-row-menu [role="menuitem"]')].map((b) => {
      const r = b.getBoundingClientRect();
      const top = root.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return [b.textContent, top === b];
    });
  });
  expect(hits).toEqual([
    ['Insert above', true],
    ['Insert below', true],
    ['Remove', true],
  ]);
});

test('B2: the row button covers nothing in its row', async ({ page }) => {
  await open(page, /^Expense report/);
  const overlaps = await page.evaluate(() => {
    const root = document.querySelector('[data-afl-paper]')!.shadowRoot!;
    const out: string[] = [];
    for (const b of root.querySelectorAll<HTMLElement>('[data-afl-row-menu]')) {
      const r = b.getBoundingClientRect();
      const row = b.closest('[data-afl-structure]')!;
      for (const el of row.querySelectorAll<HTMLElement>('*')) {
        if (el === b || el.contains(b) || el.children.length > 0) continue;
        // What shows of it: its box inside its table cell, which clips it.
        const e = el.getBoundingClientRect();
        const c = (el.closest('td, th') ?? el).getBoundingClientRect();
        const o = {
          left: Math.max(e.left, c.left),
          right: Math.min(e.right, c.right),
          top: Math.max(e.top, c.top),
          bottom: Math.min(e.bottom, c.bottom),
        };
        if (o.right <= o.left || o.bottom <= o.top) continue;
        if (o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top)
          out.push(`${b.getAttribute('aria-label')} covers ${el.tagName} "${el.textContent}"`);
      }
    }
    return out;
  });
  expect(overlaps).toEqual([]);
});

const rowsOf = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const kids = [...document.querySelector(s)!.children].filter(
      (c) => (c as HTMLElement).offsetParent !== null,
    );
    // A new row starts where a child begins below the bottom of the row before.
    const boxes = kids.map((c) => c.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    let rows = 0;
    let bottom = -Infinity;
    for (const b of boxes) {
      if (b.top >= bottom - 2) rows++;
      bottom = rows && b.top >= bottom - 2 ? b.bottom : Math.max(bottom, b.bottom);
    }
    return rows;
  }, selector);

test('B3: the toolbars keep to one row at 1280 px and three at 390 px', async ({ page }) => {
  await open(page, /^Expense report/);
  expect(await rowsOf(page, '[role="toolbar"][aria-label="Views and records"]')).toBe(1);
  const fill = page.getByRole('toolbar', { name: 'Fill' });
  await expect(fill.getByRole('button', { name: /^Undo/ })).toBeVisible();
  await expect(fill.getByRole('button', { name: 'Download XML' })).toBeVisible();
  expect(await rowsOf(page, '[role="toolbar"][aria-label="Fill"]')).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await rowsOf(page, '[role="toolbar"][aria-label="Views and records"]'),
  ).toBeLessThanOrEqual(3);
  expect(await rowsOf(page, '[role="toolbar"][aria-label="Fill"]')).toBe(1);
});

test('B4: a record nobody changed has an empty Rule Trace', async ({ page }) => {
  await open(page, /^Purchase request/);
  await page.getByRole('tab', { name: 'Rule Trace' }).click();
  await expect(page.locator('.afl-trace-empty')).toBeVisible();
});

test('B5: a button whose rules cannot run says so in the status line', async ({ page }) => {
  await open(page, /^Purchase request/);
  const n = await renders(page);
  await page.locator('[data-afl-paper] input[value="Check budget"]').click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(page.locator('.afl-status')).toContainText(
    '“Check budget” ran only in part: query connections are not available in the viewer.',
  );
});

test('B6: Undo and Redo put focus on the field the step changed', async ({ page }) => {
  await open(page, /^Purchase request/);
  await type(page, QTY, '8');
  let n = await renders(page);
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(at(page, QTY)).toHaveText('7');
  expect(await paperFocus(page)).toBe(QTY);
  n = await renders(page);
  await page.getByRole('button', { name: /^Redo/ }).click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  expect(await paperFocus(page)).toBe(QTY);
});

test('B7: Rule Trace entries wrap inside the side panel', async ({ page }) => {
  await open(page, /^Purchase request/);
  const n = await renders(page);
  await page.locator('[data-afl-paper] input[value="Check budget"]').click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await page.getByRole('tab', { name: 'Rule Trace' }).click();
  const wide = await page.evaluate(() => {
    const panel = document.querySelector('.afl-side')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.afl-trace-entry')]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > panel.right + 1 || e.scrollWidth > e.clientWidth + 1,
      )
      .map((e) => e.innerText.slice(0, 40));
  });
  expect(wide).toEqual([]);
});

test('B9: undo back to the downloaded record leaves Fill without a question', async ({ page }) => {
  await open(page, /^Expense report/, true);
  await type(page, AMOUNT, '30');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download XML' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('02-expense-report-new.xml');
  await type(page, AMOUNT, '45');
  const n = await renders(page);
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(at(page, AMOUNT)).toHaveText(/^\$?30(\.00)?$/);
  await fillSwitch(page).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeHidden();
});

test('B10: turning Fill on elsewhere names the form and record that hold the changes', async ({
  page,
}) => {
  await open(page, /^Expense report/, true);
  await type(page, AMOUNT, '55');
  // Another sample: the fill session stays with the expense report (spec 04).
  await page.locator('.afl-header .afl-menu summary').click();
  await page.locator('.afl-header .afl-menu li button', { hasText: /^Leave request\d/ }).click();
  await expect(page.locator('.afl-form-name')).toHaveText(/Leave/);
  await fillSwitch(page).click();
  const dialog = page.getByRole('dialog', { name: 'Discard your changes?' });
  await expect(dialog).toContainText(
    "You changed Expense Report (the empty form) and haven't downloaded the XML.",
  );
  await page.getByRole('button', { name: 'Keep filling' }).click();
  await page.goBack();
  await expect(at(page, AMOUNT)).toHaveText(/^\$?55(\.00)?$/);
});

test('B11: a view button moves focus into the new view', async ({ page }) => {
  await open(page, /^New hire onboarding/, true);
  await page.locator('[data-afl-paper] [data-afl-button="CTRL911"]').click();
  await expect(page.getByRole('combobox', { name: 'View' })).toHaveValue('Manager');
  // The button is gone with the old view; focus goes to the new view's first control.
  await expect.poll(() => paperFocus(page)).toBe('/my:onboarding[1]/my:newHire[1]/my:hireName[1]');
});

test('B12: opening a sample from the landing page puts focus on the form heading', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Expense report/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.afl-form-name')).toBeFocused();
});
