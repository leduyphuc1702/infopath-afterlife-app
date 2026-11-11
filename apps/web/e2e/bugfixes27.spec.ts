// Spec 27 R1: a form opened again, or reached again with Back or Forward, shows its record.
import { expect, test } from './fixtures';

test('R1: opened again from the start page, and Forward, show the record; F10 too', async ({
  page,
}) => {
  const position = page.locator('.afl-position');
  const open04 = () =>
    page
      .locator('.afl-samples button', { hasText: /^Purchase request/ })
      .first()
      .click();
  await page.goto('./');
  await open04();
  await expect(position).toHaveText('Record 1 of 20, 04-purchase-request-001.xml');
  // Way 1: Back, then the same sample again.
  await page.goBack();
  await expect(page.locator('#afl-tasks-h')).toBeVisible();
  await open04();
  await expect(position).toHaveText('Record 1 of 20, 04-purchase-request-001.xml');
  // Way 2: record 3, Back to the start page, Forward.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(position).toHaveText('Record 3 of 20, 04-purchase-request-003.xml');
  await page.goBack();
  await expect(page.locator('#afl-tasks-h')).toBeVisible();
  await page.goForward();
  await expect(position).toHaveText('Record 3 of 20, 04-purchase-request-003.xml');
  // Spec 22 F10: a record opened from Records, then Back twice: the record before Records.
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  await page
    .locator('.afl-records-table tbody tr[aria-rowindex]')
    .nth(6)
    .locator('td')
    .first()
    .click();
  await expect(position).toContainText('Record 7 of 20');
  await page.goBack();
  await page.goBack();
  await expect(position).toHaveText('Record 3 of 20, 04-purchase-request-003.xml');
});
