// Spec 24: Fill on every sample.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const paper = (page: Page) => page.locator('[data-afl-paper]');
const deepFocus = (page: Page) =>
  page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return `${a?.tagName ?? ''} ${a?.getAttribute('aria-label') ?? ''}`;
  });
async function fillSample(page: Page, sample: RegExp) {
  await page.goto('./');
  await page.locator('.afl-samples button', { hasText: sample }).first().click();
  await expect(page.locator('.afl-form-name')).toBeVisible();
  await page.getByRole('switch', { name: 'Fill' }).click();
  await expect(page.getByRole('button', { name: 'Download XML' })).toBeVisible();
}
async function retype(page: Page, name: string, text: string) {
  await paper(page).getByRole('textbox', { name, exact: true }).first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Tab');
}
async function download(page: Page) {
  const d = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download XML' }).click();
  return readFileSync(await (await d).path(), 'utf8');
}

test('W1: Undo after typing in a rich text box puts the text back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fillSample(page, /^Safety incident/);
  await retype(page, 'What happened', 'Zeta');
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeEnabled();
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(paper(page).getByRole('textbox', { name: 'What happened' })).toContainText(
    'Incident at 20:54.',
  );
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.getByRole('button', { name: 'Download XML' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('W1: an error while drawing leaves the page, the XML and the way back', async ({ page }) => {
  await page.addInitScript(() => {
    Range.prototype.setStart = () => {
      throw new Error('drawing failed on purpose');
    };
  });
  await page.goto('./#fill');
  await expect(page.locator('.afl-hint')).toBeVisible();
  await retype(page, 'Qty', '9');
  const alert = page.getByRole('alert').filter({ hasText: 'could not be drawn' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Download XML');
  // The way back asks first, as leaving Fill always does; the changes are still there.
  await alert.getByRole('button', { name: 'Back to the start' }).click();
  await page.getByRole('button', { name: 'Keep filling' }).click();
  expect(await download(page)).toContain('<my:quantity>9</my:quantity>');
});

test('W2: the calendar button picks a date that goes in as a typed one', async ({ page }) => {
  await page.goto('./#fill');
  await expect(page.locator('.afl-hint')).toBeVisible();
  const button = paper(page).getByRole('button', { name: 'Choose a date for Needed by' });
  await button.focus();
  await expect(button).toBeFocused();
  await button.click();
  await paper(page).locator('input[type="date"]').fill('2026-12-24');
  await expect(paper(page).getByRole('textbox', { name: 'Needed by' })).toContainText('2026');
  expect(await download(page)).toContain('<my:neededBy>2026-12-24</my:neededBy>');
});

for (const sample of [/^Expense report/, /^Purchase request/, /^Safety incident/, /^Weight keeper/])
  test(`X1–X4: names and roles in Fill are allowed and complete (${sample.source})`, async ({
    page,
  }) => {
    await fillSample(page, sample);
    const bad = await paper(page).evaluate((host) => {
      const root = host.shadowRoot!;
      const READONLY = new Set([
        'textbox',
        'combobox',
        'listbox',
        'checkbox',
        'spinbutton',
        'grid',
      ]);
      const roleOf = (e: Element) =>
        e.getAttribute('role') ??
        (e instanceof HTMLSelectElement
          ? 'combobox'
          : e instanceof HTMLInputElement
            ? e.type === 'checkbox'
              ? 'checkbox'
              : e.type === 'radio'
                ? 'radio'
                : e.type === 'button'
                  ? 'button'
                  : 'textbox'
            : e instanceof HTMLButtonElement
              ? 'button'
              : e instanceof HTMLImageElement
                ? 'img'
                : '');
      const out: string[] = [];
      for (const e of root.querySelectorAll('[aria-readonly]'))
        if (!READONLY.has(roleOf(e))) out.push(`X1 aria-readonly on ${e.tagName}.${e.className}`);
      for (const e of root.querySelectorAll('[aria-label]'))
        if (!roleOf(e)) out.push(`X1/X3 aria-label on ${e.tagName}.${e.className}`);
      for (const e of root.querySelectorAll('[data-afl-structure="insert"]')) {
        const shown = (e.textContent ?? '').trim().toLowerCase();
        if (shown && !(e.getAttribute('aria-label') ?? '').toLowerCase().includes(shown))
          out.push(`X2 "${e.getAttribute('aria-label')}" for "${shown}"`);
      }
      for (const e of root.querySelectorAll('img:not([alt])')) out.push(`X3 img ${e.className}`);
      for (const e of root.querySelectorAll('[data-afl-ctrl]'))
        if (
          roleOf(e) &&
          !(e.getAttribute('aria-label') ?? '').trim() &&
          !(e as HTMLInputElement).labels?.length
        )
          out.push(`X4 no name: ${e.tagName}.${e.className}`);
      return out;
    });
    expect(bad).toEqual([]);
  });

test('X5: Keep filling after Back while typing puts focus back in the field', async ({ page }) => {
  await page.goto('./#fill');
  await expect(page.locator('.afl-hint')).toBeVisible();
  await paper(page).getByRole('textbox', { name: 'Qty' }).first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('9');
  await page.goBack();
  await page.getByRole('button', { name: 'Keep filling' }).click();
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeEnabled();
  await expect.poll(() => deepFocus(page)).toBe('SPAN Qty');
});

test('D1: a rich text box that holds formatting says typing keeps the words only', async ({
  page,
}) => {
  await fillSample(page, /^Safety incident/);
  const box = paper(page).getByRole('textbox', { name: 'What happened' });
  await expect(box).toHaveAttribute('aria-description', /formatting/);
  await box.click();
  await expect(page.locator('.afl-status')).toContainText(
    'Typing in What happened keeps the words, not the formatting',
  );
});
