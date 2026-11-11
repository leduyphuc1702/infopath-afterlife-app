// Spec 25: number grouping and leaving the page.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const paper = (page: Page) => page.locator('[data-afl-paper]');
async function fill04(page: Page) {
  await page.goto('./');
  await page
    .locator('.afl-samples button', { hasText: /^Purchase request/ })
    .first()
    .click();
  await expect(page.locator('.afl-form-name')).toBeVisible();
  await page.getByRole('switch', { name: 'Fill' }).click();
  await expect(page.getByRole('button', { name: 'Download XML' })).toBeVisible();
}
/** Closes the tab as a person does; the answer is whether the browser asked first. */
async function asksOnClose(page: Page) {
  let asked = false;
  page.on('dialog', (d) => {
    asked ||= d.type() === 'beforeunload';
    void d.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await new Promise((r) => setTimeout(r, 300));
  return asked;
}

test('L1: typing still in its field makes the browser ask before the page is left', async ({
  page,
}) => {
  await fill04(page);
  await paper(page).getByRole('textbox', { name: 'Name' }).first().click();
  await page.keyboard.type('Zeta');
  expect(await asksOnClose(page)).toBe(true);
});

test('L1: a field clicked into and left as it was asks nothing', async ({ page }) => {
  await fill04(page);
  await paper(page).getByRole('textbox', { name: 'Name' }).first().click();
  expect(await asksOnClose(page)).toBe(false);
});

test('L2: Back from the first form opened returns to the start page; Forward opens it again', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .locator('.afl-samples button', { hasText: /^Purchase request/ })
    .first()
    .click();
  await expect(page.locator('.afl-form-name')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#afl-tasks-h')).toBeVisible();
  await page.goForward();
  await expect(page.locator('.afl-form-name')).toHaveText(/Purchase/);
});

test('L3: typing 1,200 in a number box stores 1200', async ({ page }) => {
  await fill04(page);
  const qty = paper(page).getByRole('textbox', { name: 'Qty' }).first();
  await qty.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('1,200');
  await page.keyboard.press('Tab');
  await expect(qty).toHaveText('1,200');
  await expect(qty).not.toHaveAttribute('aria-invalid', 'true');
  const d = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download XML' }).click();
  expect(readFileSync(await (await d).path(), 'utf8')).toContain('<my:quantity>1200</my:quantity>');
});
