import { expect, test } from './fixtures';

test('the built page loads under the CSP, with nothing from another origin', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('InfoPath Afterlife');
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("default-src 'none'");
});

test.fail('the guards fail a test when the page breaks the CSP', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = 'https://example.invalid/x.png';
    document.body.append(img);
  });
  await page.waitForTimeout(200);
});
