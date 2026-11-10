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

// R7.2: the notices page loads under the same CSP, and links back to the viewer.
test('the notices page opens from the footer, with no violation', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Licences and notices' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Licences and notices');
  await expect(
    page.getByRole('heading', { name: 'Weight keeper sample, by Peter Theill' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', /^(light|dark)$/);
  await page.getByRole('link', { name: 'Back to the viewer' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('InfoPath Afterlife');
});
