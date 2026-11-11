// Spec 28 R1: Find matches a number or a date as the record stores it.
import { expect, test } from './fixtures';

test('R1: Find finds 1423.94 and 2026-05-13 in the purchase requests', async ({ page }) => {
  await page.goto('./');
  await page
    .locator('.afl-samples button', { hasText: /^Purchase request/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  const rows = page.locator('.afl-records-table tbody tr[aria-rowindex]');
  const find = page.getByRole('searchbox', { name: 'Find' });
  await expect(rows).toHaveCount(20);
  await find.fill('1423.94');
  await expect(rows).toHaveCount(1);
  await find.fill('2026-05-13');
  await expect(rows).toHaveCount(1);
  // Round 2: a stored number ending in zero, and a line total in a repeating row.
  await find.fill('2978.30');
  await expect(rows).toHaveCount(1);
  await find.fill('1334.60');
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.afl-records-table tbody')).toContainText('Line total: $1,334.60');
});
