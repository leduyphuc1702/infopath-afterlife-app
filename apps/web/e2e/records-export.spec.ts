import type { Page } from '@playwright/test';
// The zip modules only: core's index pulls in the XSLT engine, which Playwright's loader rejects.
import { readZip } from '../../../packages/core/src/zip/read';
import { writeZip } from '../../../packages/core/src/zip/write';
import { expect, test } from './fixtures';
import { bytes, recordPaths, xsnPath } from './files';

// Spec 09 R12.1–R12.9: "Export records" from the form screen, and `.zip` input.

const name = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const triage = (page: Page) => page.getByRole('region', { name: 'Triage' });

async function exported(page: Page, item: RegExp) {
  await page.getByText('Export records').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: item }).click(),
  ]);
  const path = await download.path();
  return { fileName: download.suggestedFilename(), bytes: bytes(path) };
}

async function parts(zip: Uint8Array) {
  const out = new Map<string, string>();
  for (const e of readZip(zip)) out.set(e.name, new TextDecoder().decode(await e.read()));
  return out;
}

/** A zip the test drops, through the "Open files" picker. */
async function dropZip(
  page: Page,
  fileName: string,
  entries: { name: string; bytes: Uint8Array }[],
) {
  const buffer = Buffer.from(await writeZip(entries));
  await page
    .locator('[data-afl-picker]')
    .setInputFiles([{ name: fileName, mimeType: 'application/zip', buffer }]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('sample 02: the workbook has 30 record rows and a known value; the CSV zip has the receipts', async ({
  page,
  context,
}) => {
  const requested: string[] = [];
  await page.getByRole('button', { name: /^Expense report/ }).click();
  await expect(page.locator('.afl-root')).toBeVisible();
  context.on('request', (r) => requested.push(r.url()));
  const xlsx = await exported(page, /Excel workbook/);
  expect(xlsx.fileName).toBe('02-expense-report-records.xlsx');
  const book = await parts(xlsx.bytes);
  const sheet = book.get('xl/worksheets/sheet1.xml')!;
  expect(sheet.match(/<row /g)).toHaveLength(31);
  expect(book.get('xl/sharedStrings.xml')).toContain('<t xml:space="preserve">Ivo Corvin</t>');
  expect(book.get('xl/workbook.xml')).toContain('<sheet name="expense"');
  await expect(page.locator('.afl-status')).toContainText(
    'Exported 30 records to 02-expense-report-records.xlsx.',
  );

  const csv = await exported(page, /CSV files and attachments/);
  expect(csv.fileName).toBe('02-expense-report-records.zip');
  const files = await parts(csv.bytes);
  expect(files.get('Records.csv')!.split('\r\n')).toHaveLength(32);
  expect(files.get('attachments/02-expense-report-003/receipt/receipt-03-1.txt')).toMatch(
    /^RECEIPT/,
  );
  // Nothing was fetched or sent: the downloads are blob: URLs (the guards fail any other origin).
  expect(requested.filter((u) => !u.startsWith('blob:'))).toEqual([]);
});

test('a template with no records has no "Export records"', async ({ page }) => {
  await page.locator('[data-afl-picker]').setInputFiles(xsnPath('04-purchase-request'));
  await expect(page.locator('.afl-root')).toBeVisible();
  await expect(page.getByText('Export records')).toHaveCount(0);
});

test('a .zip of forms 01 and 02 with records, in folders, lands on Triage with 2 forms', async ({
  page,
}) => {
  const entries = [
    { name: 'Forms/01-leave-request.xsn', bytes: bytes(xsnPath('01-leave-request')) },
    { name: 'Forms/02-expense-report.xsn', bytes: bytes(xsnPath('02-expense-report')) },
    ...recordPaths('01-leave-request', 4).map((p) => ({
      name: `Leave/${name(p)}`,
      bytes: bytes(p),
    })),
    ...recordPaths('02-expense-report', 3).map((p) => ({
      name: `Claims/2025/${name(p)}`,
      bytes: bytes(p),
    })),
    { name: 'Forms/readme.txt', bytes: new TextEncoder().encode('hello') },
    { name: 'old.zip', bytes: new Uint8Array([0x50, 0x4b, 5, 6]) },
  ];
  await dropZip(page, 'library.zip', entries);
  const rows = triage(page).locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(triage(page)).toContainText('2 forms');
  await expect(rows.filter({ hasText: '01-leave-request.xsn' }).locator('td').nth(10)).toHaveText(
    '4',
  );
  await expect(rows.filter({ hasText: '02-expense-report.xsn' }).locator('td').nth(10)).toHaveText(
    '3',
  );
  const ignored = page.getByRole('region', { name: /Files not opened/ });
  await expect(ignored).toContainText('library.zip › Forms/readme.txt');
  await expect(ignored).toContainText('A .zip inside a .zip is not opened.');
});

test('a damaged .zip gets a three-part message', async ({ page }) => {
  await page
    .locator('[data-afl-picker]')
    .setInputFiles([
      { name: 'broken.zip', mimeType: 'application/zip', buffer: Buffer.from('PK not a zip') },
    ]);
  await expect(page.getByRole('alert')).toContainText("We couldn't open broken.zip.");
  await expect(page.getByRole('alert')).toContainText('The .zip file is damaged');
});

// R12.9 (AC 10): 1,000 records of form 02, made here from its 30 by repeating them, each copy
// made distinct with a trailing comment; from the click to the saved workbook, in the Worker.
test('1,000 records of form 02 export in the Worker within the budget', async ({ page }) => {
  test.setTimeout(120_000);
  const sources = recordPaths('02-expense-report').map((p) => bytes(p).toString('utf8'));
  const entries = [
    { name: '02-expense-report.xsn', bytes: bytes(xsnPath('02-expense-report')) },
    ...Array.from({ length: 1000 }, (_, i) => ({
      name: `records/02-expense-report-${String(i + 1).padStart(4, '0')}.xml`,
      bytes: new TextEncoder().encode(`${sources[i % sources.length]}\n<!-- copy ${i} -->\n`),
    })),
  ];
  await dropZip(page, 'thousand.zip', entries);
  await expect(page.getByText('Record 1 of 1000,', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  for (const [format, item] of [
    ['xlsx', /Excel workbook/],
    ['csv', /CSV files and attachments/],
  ] as const) {
    const t0 = Date.now();
    const out = await exported(page, item);
    const ms = Date.now() - t0;
    console.log(
      `R12.9: 1,000 records of form 02 to ${format}: ${ms} ms, ${(out.bytes.length / 1024).toFixed(0)} KB`,
    );
    expect(ms).toBeLessThan(5_000);
    if (format === 'xlsx')
      expect(
        (await parts(out.bytes)).get('xl/worksheets/sheet1.xml')!.match(/<row /g),
      ).toHaveLength(1001);
  }
});
