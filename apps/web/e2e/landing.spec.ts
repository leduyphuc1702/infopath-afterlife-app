// The first screen as a product page: section links, the way home, the picture, the questions.
// Not written by Kiro (README, "What Kiro did not write").
import { expect, test } from './fixtures';

const nav = 'nav[aria-label="On this page"]';

test('the header leads to the sections of the first screen, and only there', async ({ page }) => {
  await page.goto('./');
  const links = page.locator(`${nav} button`);
  await expect(links).toHaveText(['Features', 'How it works', 'Privacy', 'FAQ']);

  for (const [name, id] of [
    ['How it works', 'afl-how'],
    ['Privacy', 'afl-private'],
    ['FAQ', 'afl-faq'],
    ['Features', 'afl-tasks-h'],
  ] as const) {
    await page.locator(nav).getByRole('button', { name, exact: true }).click();
    await expect(page.locator(`#${id}`)).toBeInViewport();
    // The header stays on top and does not cover the heading it led to.
    const bar = (await page.locator('.afl-header').boundingBox())!;
    await expect
      .poll(async () => (await page.locator(`#${id}`).boundingBox())!.y)
      .toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  }
  // A section is not an address: a task's `#address` stays the only hash.
  await expect(page).not.toHaveURL(/#/);

  await page.goto('./#fill');
  await expect(page.getByRole('switch', { name: 'Fill' })).toBeVisible();
  await expect(page.locator(nav)).toHaveCount(0);
});

test('the product name leads back to the first screen', async ({ page }) => {
  await page.goto('./#read');
  await expect(page.locator('.afl-position')).toContainText('02-expense-report-001.xml');
  await page.getByRole('link', { name: 'InfoPath Afterlife', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start with a task' })).toBeVisible();
  await expect(page).not.toHaveURL(/#/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page.locator('.afl-position')).toContainText('02-expense-report-001.xml');
});

test('Back from a task returns to the task cards, not to the top of the page', async ({ page }) => {
  await page.goto('./');
  await page.locator('.afl-tasks a[href="#fill"]').click();
  await expect(page.getByRole('switch', { name: 'Fill' })).toBeVisible();
  await page.goBack();
  const heading = page.locator('#afl-tasks-h');
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  // The cards are on screen, under the header that stays in view.
  await expect(page.locator('.afl-tasks a[href="#find"]')).toBeInViewport();
  const bar = (await page.locator('.afl-header').boundingBox())!;
  expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
});

test('the picture is this app, described, and follows the colour scheme', async ({ page }) => {
  await page.goto('./');
  const shot = page.locator('.afl-shot img');
  await expect(shot).toHaveAttribute('alt', /Purchase request sample.*Rule Trace/);
  await expect.poll(() => shot.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1920);
  expect(await shot.evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(/shot-light/);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() => shot.evaluate((i: HTMLImageElement) => i.currentSrc))
    .toMatch(/shot-dark/);
});

test('a question opens its answer, by pointer and by keyboard', async ({ page }) => {
  await page.goto('./');
  const first = page.locator('.afl-faq details').first();
  await expect(page.locator('.afl-faq details')).toHaveCount(7);
  await expect(first.locator('div')).toBeHidden();
  await first.locator('summary').click();
  await expect(first.locator('div')).toContainText('reads the .xsn template itself');

  const second = page.locator('.afl-faq details').nth(1);
  await second.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(second.locator('div')).toContainText('forbids network requests');
});

test('the numbers on the page are counted from the bundled samples', async ({ page }) => {
  await page.goto('./');
  const stat = (words: string) =>
    page.locator('.afl-stats div', { hasText: words }).locator('dt').innerText();
  const forms = Number(await stat('sample forms built in'));
  await page.locator('.afl-triage-all .afl-button').click();
  await expect(page.locator('#afl-triage-h')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Triage' }).locator('tbody tr')).toHaveCount(forms);
});

test('the closing buttons do what the first ones do', async ({ page }) => {
  await page.goto('./');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open your forms' }).click();
  await chooser;
  await page.getByRole('button', { name: 'Start with a sample' }).click();
  await expect(page).toHaveURL(/#read$/);
});

for (const width of [320, 390, 820, 1280, 1920]) {
  test(`at ${width} px the whole first screen fits its width, light and dark`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('./');
      await expect(page.locator('html[data-ready]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
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
