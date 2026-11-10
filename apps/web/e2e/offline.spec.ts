import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

// Spec 09 R8.1, design D7: once `<html data-ready>` is set, the page works with the network
// off: opening a sample, paging, switching views and dropping files. Playwright's offline mode
// fails every request, same-origin ones included, so anything not loaded by the warm-up shows
// up as a failed request.

test('after warm-up, a sample, paging, views and dropped files all work offline', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await expect(page.locator('html[data-ready]')).toHaveCount(1);
  const requested: string[] = [];
  const failed: string[] = [];
  context.on('request', (r) => requested.push(r.url()));
  context.on('requestfailed', (r) => failed.push(r.url()));
  await context.setOffline(true);

  // A sample: its bytes come from the chunk the warm-up imported.
  await page.getByRole('button', { name: /^Travel request/ }).click();
  const paper = (end: string) =>
    page.getByRole('region', { name: new RegExp(`${end}$`) }).locator('.afl-root');
  await expect(paper('Employee view, empty form')).toBeVisible();

  // Paging and switching views render in the Worker, with no request.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(paper('Employee view, 03-travel-request-001.xml')).toBeVisible();
  await page
    .getByRole('toolbar', { name: 'Views and records' })
    .locator('select')
    .selectOption({ label: 'Accounting' });
  await expect(paper('Accounting view, 03-travel-request-001.xml')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(paper('Accounting view, 03-travel-request-002.xml')).toBeVisible();

  // Files opened while offline.
  // Two templates now: Triage, a certificate and the form (spec 12 R7.3), all offline.
  await pick(page, [xsnPath('02-expense-report'), ...recordPaths('02-expense-report', 2)]);
  await expect(page.getByRole('region', { name: 'Triage' }).locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Expense Report' }).click();
  await expect(
    page.getByRole('heading', { name: 'Death certificate: Expense Report' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open form' }).click();
  await expect(paper('Claim view, empty form')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(paper('Claim view, 02-expense-report-001.xml')).toBeVisible();

  expect({ requested, failed }).toEqual({ requested: [], failed: [] });
});

// D7: only the Latin faces are warmed up. A name in Vietnamese needs another face, which cannot
// load offline; the text falls back to a system font and the notes under the paper say so.
test('offline, characters outside Latin get a note under the paper', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('html[data-ready]')).toHaveCount(1);
  const failed: string[] = [];
  context.on('requestfailed', (r) => failed.push(r.url()));
  await context.setOffline(true);

  const [recordPath] = recordPaths('02-expense-report', 1);
  const record = bytes(recordPath!)
    .toString('utf8')
    .replace(
      '<my:claimantName>Kenji Brask</my:claimantName>',
      '<my:claimantName>Nguyễn Thị Ánh</my:claimantName>',
    );
  expect(record).toContain('Nguyễn');
  await pick(page, [
    xsnPath('02-expense-report'),
    { name: '02-expense-report-001.xml', mimeType: 'text/xml', buffer: Buffer.from(record) },
  ]);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(
    page
      .getByRole('region', { name: /Claim view, 02-expense-report-001\.xml$/ })
      .locator('.afl-root'),
  ).toBeVisible();
  await expect(page.locator('.afl-notes')).toContainText(
    'Some characters are shown in a system font',
  );
  // The only failed requests are Carlito faces of other subsets.
  expect(failed.length).toBeGreaterThan(0);
  for (const url of failed)
    expect(url).toMatch(/\/carlito-(?!latin-\d)[a-z-]+-\d+-(normal|italic)-[\w-]+\.woff2$/);
});
