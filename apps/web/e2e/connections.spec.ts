import { expect, test } from './fixtures';

// Spec 09 R6.1: the "Data connections" tab, and its links both ways with the card and the tree.

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Purchase request/ }).click();
  await expect(page.getByRole('tree', { name: 'Fields' })).toBeVisible();
});

test('sample 04: two dead connections; a field in the panel selects it in the tree', async ({
  page,
}) => {
  await page.getByRole('tab', { name: 'Data connections' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Data connections' });
  const sql = panel.getByRole('article', { name: 'Vendors' });
  const ws = panel.getByRole('article', { name: 'BudgetService' });
  await expect(sql).toContainText('Database (SQL)');
  await expect(sql).toContainText('Dead after migration');
  await expect(sql).toContainText('internal server sql-legacy01');
  await expect(ws).toContainText('internal server forms-legacy');
  await sql.getByRole('button', { name: /^Vendor \(from sql-legacy01\) \(drop-down/ }).click();
  await expect(page.getByRole('tab', { name: 'Fields' })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('treeitem', { name: /^Vendor \(from sql-legacy01\)/ }),
  ).toHaveAttribute('aria-selected', 'true');
});

test("the card's connection opens its entry in the panel", async ({ page }) => {
  await page.getByRole('treeitem', { name: /^Vendor \(from sql-legacy01\)/ }).click();
  const card = page.getByRole('region', { name: 'Vendor (from sql-legacy01)' });
  await card.getByRole('button', { name: 'Vendors' }).click();
  const entry = page.getByRole('article', { name: 'Vendors' });
  await expect(entry).toHaveAttribute('aria-current', 'true');
  await expect(entry).toBeFocused();
});
