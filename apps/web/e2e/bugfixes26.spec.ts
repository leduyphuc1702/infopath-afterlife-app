// Spec 26: what the last rounds left.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const sample = (page: Page, name: RegExp) =>
  page.locator('.afl-samples button', { hasText: name }).first().click();

test('M1: Back to the start page, then Forward to Triage, shows Triage', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Triage all samples/ }).click();
  await expect(page.locator('#afl-triage-h')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#afl-tasks-h')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#afl-triage-h')).toBeVisible();
});

test('M2: a bundled sample opened again just opens, with no notice', async ({ page }) => {
  await page.goto('./');
  await sample(page, /^Purchase request/);
  await expect(page.locator('.afl-form-name')).toHaveText(/Purchase/);
  await page.goBack();
  await expect(page.locator('#afl-tasks-h')).toBeVisible();
  await sample(page, /^Purchase request/);
  await expect(page.locator('.afl-form-name')).toHaveText(/Purchase/);
  await page.goBack();
  await page.getByRole('button', { name: /Triage all samples/ }).click();
  await expect(page.locator('#afl-triage-h')).toBeVisible();
  await expect(page.locator('.afl-status')).not.toContainText('already open');
  await expect(page.getByText(/already open/)).toHaveCount(0);
});

test('F12: the caption stops asking for a group once one is chosen', async ({ page }) => {
  await page.goto('./');
  await sample(page, /^Expense report/);
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await page.getByRole('button', { name: 'Summarize' }).click();
  const caption = page.locator('.afl-summary-table caption');
  await expect(caption).toContainText('Choose a group to list its records.');
  await page.locator('.afl-summary-table [aria-pressed]').first().click();
  await expect(page.locator('.afl-summary-table [aria-pressed="true"]')).toHaveCount(1);
  await expect(caption).not.toContainText('Choose a group');
});
