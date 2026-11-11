// Spec 21: start from a task, from the landing page and from its address.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const hint = (page: Page) => page.locator('.afl-hint');
const position = (page: Page) => page.locator('.afl-position');

const LANDS: Record<string, (page: Page) => Promise<void>> = {
  read: async (page) => {
    await expect(position(page)).toContainText('02-expense-report-001.xml');
    await expect(page.getByRole('switch', { name: 'Fill' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  },
  rules: async (page) => {
    await expect(page.locator('.afl-form-name')).toContainText('Purchase');
    await expect(page.getByRole('button', { name: 'X-ray' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
  fill: async (page) => {
    await expect(page.getByRole('switch', { name: 'Fill' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Rule Trace' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(position(page)).toContainText('04-purchase-request-001.xml');
  },
  find: async (page) => {
    await expect(page.locator('#afl-records-h')).toHaveText('Expense Report: records');
    await expect(page.getByRole('button', { name: 'Summarize' })).toBeVisible();
  },
  keep: async (page) => {
    await expect(page.getByRole('button', { name: 'Web pages to keep (.zip)' })).toBeVisible();
    await expect(page.locator('.afl-form-name')).toContainText('Onboarding');
  },
  document: async (page) => {
    await expect(page.locator('#afl-doc-h')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
  },
  triage: async (page) => {
    await expect(page.locator('#afl-triage-h')).toBeVisible();
  },
};

const tasks = Object.keys(LANDS);
const landing = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Start with a task' })).toBeVisible();
  await expect(page.locator('.afl-tasks a')).toHaveCount(7);
};

for (const id of tasks) {
  test(`R1–R4: the ${id} task from the page lands in its state, with one line; Back returns`, async ({
    page,
  }) => {
    await page.goto('./');
    await landing(page);
    await page.locator(`.afl-tasks a[href="#${id}"]`).click();
    await LANDS[id]!(page);
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(hint(page)).toHaveCount(1);
    await expect(page.locator('[data-afl-announce]')).toHaveText(
      await hint(page).locator('span').innerText(),
    );
    await page.goBack();
    await landing(page);
    await expect(page).not.toHaveURL(/#/);
    await expect(page.locator('#afl-tasks-h')).toBeFocused();
  });

  test(`R5: the address #${id} opens the task directly; Back returns to the landing page`, async ({
    page,
  }) => {
    await page.goto(`./#${id}`);
    await LANDS[id]!(page);
    await expect(hint(page)).toBeVisible();
    await page.goBack();
    await landing(page);
  });
}

test('R3: the line goes when the person acts, or with Close tip', async ({ page }) => {
  await page.goto('./#read');
  await expect(hint(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close tip' }).click();
  await expect(hint(page)).toHaveCount(0);
  await page.goto('./');
  await page.goto('./#find');
  await expect(hint(page)).toBeVisible();
  await page.getByRole('searchbox', { name: 'Find' }).fill('sales');
  await expect(hint(page)).toHaveCount(0);
});

test('R6: an address the app does not know opens the landing page and says nothing', async ({
  page,
}) => {
  await page.goto('./#nothing-here');
  await landing(page);
  await expect(hint(page)).toHaveCount(0);
  await expect(page.locator('[role="alert"], .afl-error')).toHaveCount(0);
  await expect(page).not.toHaveURL(/#/);
});

test('R7: at 390 px the landing page has no sideways scroll; each task is one tap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await landing(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const heights = await page
    .locator('.afl-tasks a')
    .evaluateAll((as) => as.map((a) => a.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
});
