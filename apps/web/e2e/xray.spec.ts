import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Spec 09 R5.1, R5.2: X-ray both ways, with a real pointer on the inert paper.

async function openRecord1(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /^Expense report/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(
    page.getByRole('region', { name: /02-expense-report-001\.xml/ }).locator('.afl-root'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'X-ray' }).click();
  await expect(page.getByRole('button', { name: 'X-ray' })).toHaveAttribute('aria-pressed', 'true');
}

/** The centre of the control bound to `path`, in page coordinates. */
const centreOf = (page: Page, path: string) =>
  page.evaluate((p) => {
    const host = document.querySelector('[data-afl-paper]')!;
    const r = host.shadowRoot!.querySelector(`[data-afl-path="${p}"]`)!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, path);

test('paper → tree: pointing at the Total outlines it, selects it and shows its calculation', async ({
  page,
}) => {
  await openRecord1(page);
  const { x, y } = await centreOf(page, '/my:expenseClaim[1]/my:totalAmount[1]');
  await page.mouse.move(x, y);
  await expect(page.locator('.afl-outline')).toHaveCount(1);
  const card = page.getByRole('region', { name: 'Total' });
  await expect(card).toContainText('/my:expenseClaim/my:totalAmount');
  await expect(card).toContainText('Calculation');
  await expect(card).toContainText('sum(xdMath:Nz(../my:expenses/my:expense/my:amount))');
  await expect(page.getByRole('treeitem', { name: /^Total/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // The outline sits on the control (within 1 px).
  const outline = (await page.locator('.afl-outline').boundingBox())!;
  expect(Math.abs(outline.x + outline.width / 2 - x)).toBeLessThanOrEqual(1);
  expect(Math.abs(outline.y + outline.height / 2 - y)).toBeLessThanOrEqual(1);
});

test('tree → paper: selecting Amount outlines its control in both expense rows', async ({
  page,
}) => {
  await openRecord1(page);
  await page.getByRole('treeitem', { name: /^Amount/ }).click();
  await expect(page.locator('.afl-outline')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Amount' })).toContainText('Decimal');
});

// Layout: at 1280×800 the default view of forms 01–08 needs no horizontal scrolling.
test('forms 01–08 fit the paper at 1280×800', async ({ page }) => {
  await page.goto('./');
  const report: string[] = [];
  let last = '\u0000';
  for (const name of [
    'Leave request',
    'Expense report',
    'Travel request',
    'Purchase request',
    'New hire onboarding',
    'Safety incident',
    'Leave request v2',
    'Big form',
  ]) {
    await page.locator('.afl-menu summary').click();
    await page.locator('.afl-menu li button', { hasText: new RegExp(`^${name}(\\d|No)`) }).click();
    await expect(page.locator('.afl-form-name')).not.toHaveText(last);
    last = (await page.locator('.afl-form-name').textContent()) ?? '';
    await expect(page.getByRole('toolbar', { name: 'Views and records' })).toBeVisible();
    await page.waitForTimeout(300);
    const [scroll, client] = await page
      .locator('.afl-paper-frame')
      .evaluate((f) => [f.scrollWidth, f.clientWidth]);
    report.push(`${name}: ${scroll - client > 0 ? `+${scroll - client} px` : 'fits'}`);
  }
  console.log(report.join('\n'));
  expect(report.filter((r) => !r.endsWith('fits'))).toEqual([]);
});
