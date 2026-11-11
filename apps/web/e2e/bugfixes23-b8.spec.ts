// Spec 23 B8 (round 2): with WCAG 1.4.12 text spacing, the position line wraps instead of being cut.
import { expect, test } from './fixtures';

const SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`;

for (const width of [1280, 320])
  test(`B8: the position line is whole with 1.4.12 spacing at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./');
    await page
      .locator('.afl-samples button', { hasText: /^Expense report/ })
      .first()
      .click();
    const position = page.locator('.afl-position');
    await expect(position).toContainText('02-expense-report-001.xml');
    await page.addStyleTag({ content: SPACING });
    const m = await position.evaluate((e) => ({
      scroll: e.scrollWidth,
      client: e.clientWidth,
      text: e.textContent,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(m.scroll).toBeLessThanOrEqual(m.client);
    expect(m.text).toMatch(/^Record 1 of \d+, 02-expense-report-001\.xml$/);
    expect(m.page).toBeLessThanOrEqual(0);
  });
