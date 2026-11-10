import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// R9.2: open a sample, switch view, page, turn X-ray on, select a field and read its card, with
// the keyboard only. Every stop shows a focus ring; nothing inside the paper takes focus.

/** Presses Tab until `match` has focus; returns how many presses it took. */
async function tabTo(page: Page, match: () => boolean, max = 60) {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const el = document.activeElement!;
      const inPaper = !!document.querySelector('[data-afl-paper]')?.shadowRoot?.activeElement;
      return {
        inPaper,
        outline: getComputedStyle(el).outlineStyle,
        html: el.outerHTML.slice(0, 120),
      };
    });
    expect(state.inPaper, state.html).toBe(false);
    expect(state.outline, state.html).not.toBe('none');
    if (await page.evaluate(match)) return i;
  }
  throw new Error('focus never reached the target');
}

const focusedText = (page: Page) => page.evaluate(() => document.activeElement?.textContent ?? '');

test('the whole X-ray flow from the keyboard', async ({ page }) => {
  await page.goto('./');
  await page.locator('body').click({ position: { x: 1, y: 1 } }); // focus the page, not a control
  await tabTo(page, () => {
    const el = document.activeElement!;
    return el.tagName === 'BUTTON' && /^Travel request/.test(el.textContent ?? '');
  });
  await page.keyboard.press('Enter');
  const region = (end: RegExp) => page.getByRole('region', { name: end }).locator('.afl-root');
  await expect(region(/Employee view, empty form$/)).toBeAttached();

  // The view selector: typing a caption's first letter chooses it (on every platform; macOS
  // opens the list on ArrowDown instead of moving the selection).
  await tabTo(page, () => document.activeElement!.tagName === 'SELECT');
  await page.keyboard.press('a');
  await expect(region(/Accounting view, empty form$/)).toBeAttached();

  // Next record.
  await tabTo(page, () => document.activeElement!.textContent === 'Next');
  await page.keyboard.press('Enter');
  await expect(region(/Accounting view, 03-travel-request-001\.xml$/)).toBeAttached();

  // X-ray on: the switch is before the toolbar, so Shift+Tab back to it.
  for (let i = 0; i < 20 && (await focusedText(page)) !== 'X-ray'; i++)
    await page.keyboard.press('Shift+Tab');
  expect(await focusedText(page)).toBe('X-ray');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'true');

  // The tree: one tab stop, then arrows; Enter selects.
  await tabTo(page, () => document.activeElement!.getAttribute('role') === 'treeitem');
  const focusedId = () => page.evaluate(() => document.activeElement?.getAttribute('data-id'));
  const want = 'f:main:/my:travelRequest/my:traveler/my:travelerName';
  for (let i = 0; i < 40 && (await focusedId()) !== want; i++)
    await page.keyboard.press('ArrowDown');
  expect(await focusedId()).toBe(want);
  await page.keyboard.press('Enter');
  // Its label in the form is "Name".
  const card = page.getByRole('region', { name: 'Name' });
  await expect(card).toContainText('Required');
  await expect(card).toContainText('/my:travelRequest/my:traveler/my:travelerName');
  await expect(page.locator('.afl-outline')).toHaveCount(1);
});
