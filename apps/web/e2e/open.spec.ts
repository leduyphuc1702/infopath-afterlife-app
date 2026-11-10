import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

// Spec 09 R1.1–R1.3, R2.1, R2.2: opening files, matching records, the template list.

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('a template, three records and a text file: one form, three records, one file not opened', async ({
  page,
}) => {
  await pick(page, [
    xsnPath('02-expense-report'),
    ...recordPaths('02-expense-report', 3),
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
  ]);
  await expect(page.getByRole('toolbar', { name: 'Views and records' })).toContainText(
    'Expense Report',
  );
  await expect(page.getByRole('region', { name: 'Templates' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Record 1 of 3, 02-expense-report-001.xml')).toBeVisible();
  const ignored = page.getByRole('region', { name: /Files not opened/ });
  await expect(ignored).toContainText('Files not opened (1)');
  await expect(ignored).toContainText('notes.txt');
});

test('a damaged template gets a three-part message; the other template still opens', async ({
  page,
}) => {
  const whole = bytes(xsnPath('02-expense-report'));
  await pick(page, [
    {
      name: '02-truncated.xsn',
      mimeType: 'application/octet-stream',
      buffer: whole.subarray(0, 300),
    },
    xsnPath('03-travel-request'),
  ]);
  await expect(page.getByRole('toolbar', { name: 'Views and records' })).toContainText(
    'Travel Request',
  );
  const alerts = page.getByRole('alert');
  await expect(alerts).toHaveCount(1);
  await expect(alerts).toContainText("We couldn't open 02-truncated.xsn.");
});

test('forms 01 and 07 with all their records: two templates, 30 and 10 records', async ({
  page,
}) => {
  await pick(page, [
    xsnPath('01-leave-request'),
    xsnPath('07-leave-request-v2'),
    ...recordPaths('01-leave-request'),
    ...recordPaths('07-leave-request-v2'),
  ]);
  const rows = page.getByRole('region', { name: 'Templates (2)' }).locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('01-leave-request.xsn');
  await expect(rows.nth(0).locator('td').nth(3)).toHaveText('30');
  await expect(rows.nth(1)).toContainText('07-leave-request-v2.xsn');
  await expect(rows.nth(1).locator('td').nth(3)).toHaveText('10');
  await expect(page.getByRole('region', { name: /Records not matched/ })).toHaveCount(0);
});

test("form 07 alone takes 01's records as another version", async ({ page }) => {
  await pick(page, [xsnPath('07-leave-request-v2'), ...recordPaths('01-leave-request', 2)]);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Made with version 1.0.0.1')).toBeVisible();
});

test('records with no open template, and plain XML, are listed with their reasons', async ({
  page,
}) => {
  await pick(page, [
    ...recordPaths('01-leave-request'),
    { name: 'plain.xml', mimeType: 'text/xml', buffer: Buffer.from('<?xml version="1.0"?><a/>') },
  ]);
  const list = page.getByRole('region', { name: /Records not matched/ });
  await expect(list).toContainText('Records not matched (31)');
  await expect(list.locator('li', { hasText: 'plain.xml' })).toContainText(
    'It does not say which InfoPath form made it.',
  );
  await expect(list.locator('li', { hasText: '01-leave-request-001.xml' })).toContainText(
    'No open template has its form ID',
  );
});

test('files dropped on the page open', async ({ page }) => {
  const b64 = bytes(xsnPath('03-travel-request')).toString('base64');
  await page.evaluate((data) => {
    const file = new File(
      [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
      '03-travel-request.xsn',
    );
    const dt = new DataTransfer();
    dt.items.add(file);
    document.body.dispatchEvent(
      new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
    );
  }, b64);
  await expect(page.getByRole('toolbar', { name: 'Views and records' })).toContainText(
    'Travel Request',
  );
});
