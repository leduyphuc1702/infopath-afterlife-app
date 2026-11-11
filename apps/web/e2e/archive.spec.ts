// Spec 18: records as web pages, from the form screen and from the Records screen.
import { readFileSync } from 'node:fs';
import type { Download, Page } from '@playwright/test';
import { readZip } from '../../../packages/core/src/zip/read';
import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

const unzip = async (d: Download) => {
  const zip = readFileSync(await d.path());
  const out = new Map<string, Uint8Array>();
  for (const e of readZip(zip, { limits: { entries: 100_000 } }))
    if (!e.directory) out.set(e.name, await e.read());
  return { zip, out };
};
const text = (b: Uint8Array | undefined) => new TextDecoder().decode(b);

// Spec 19 A2: on the form screen the archive is the third choice of "Export records".
async function archiveFromForm(page: Page) {
  await page.locator('summary', { hasText: 'Export records' }).click();
  const dl = page.waitForEvent('download', { timeout: 120_000 });
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Web pages to keep (.zip)' }).click();
  const d = await dl;
  const ms = Date.now() - t0;
  return { d, ms };
}

test('R1–R5, R7, R8: form 02 from the form screen; the page draws as the paper; status says what was saved', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Expense report/ })
    .first()
    .click();
  const { d, ms } = await archiveFromForm(page);
  const { zip, out } = await unzip(d);
  console.log(`R2 form 02: 30 records in ${ms} ms, ${zip.byteLength} bytes`);
  expect(d.suggestedFilename()).toBe('02-expense-report-archive.zip');
  await expect(page.locator('.afl-status')).toContainText(
    'Archived 30 records as 30 web pages in 02-expense-report-archive.zip.',
  );
  expect([...out.keys()].filter((n) => n.endsWith('.html'))).toHaveLength(31);
  expect(text(out.get('README.txt'))).toContain('needed');
  // R3: the archived page shows the same text as the paper in read mode.
  const paperText = await page
    .locator('[data-afl-paper]')
    .evaluate((p) =>
      p.shadowRoot!.querySelector('.afl-root')!.textContent.replace(/\s+/g, ' ').trim(),
    );
  await page.setContent(text(out.get('02-expense-report-001.html')));
  const archived = (await page.locator('.afl-archive-page .afl-root').textContent())!
    .replace(/\s+/g, ' ')
    .trim();
  expect(archived).toBe(paperText);
});

test('R1: the Records screen archives the records found, in its order', async ({ page }) => {
  await page.goto('./');
  await page
    .getByRole('button', { name: /^Expense report/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Records', exact: true }).click();
  // Spec 19 F1: the list shows "Pound sterling", as the paper does.
  await page.getByRole('searchbox', { name: 'Find' }).fill('pound');
  await page.getByRole('button', { name: 'Total', exact: true }).click();
  await expect(page.locator('.afl-records-count')).toHaveText(/^(\d+) of 30 records match\.$/);
  const files = await page
    .locator('.afl-records-table tbody tr[aria-rowindex] th')
    .allTextContents();
  await page.locator('summary', { hasText: 'Archive as web pages' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: `Archive ${files.length} records (.zip)` }).click();
  const { out } = await unzip(await dl);
  const index = text(out.get('index.html'));
  const order = [...index.matchAll(/<th scope="row"><a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
  expect(order).toEqual(files);
});

test('R8, R10: 1,000 generated records: progress, then Cancel saves nothing; then measured', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('./');
  const base = bytes(recordPaths('02-expense-report', 1)[0]!).toString('utf8');
  const all = Array.from({ length: 1000 }, (_, i) => ({
    name: `gen-${String(i + 1).padStart(4, '0')}.xml`,
    mimeType: 'text/xml',
    buffer: Buffer.from(
      base.replace(/<my:claimantName>[^<]*</, `<my:claimantName>Person ${i + 1}<`),
    ),
  }));
  await pick(page, [xsnPath('02-expense-report'), ...all.slice(0, 999)]);
  await expect(page.locator('.afl-position')).toContainText('of 999,', { timeout: 60_000 });
  await pick(page, all.slice(999));
  await expect(page.locator('.afl-position')).toContainText('of 1000,', { timeout: 60_000 });

  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('summary', { hasText: 'Export records' }).click();
  await page.getByRole('button', { name: 'Web pages to keep (.zip)' }).click();
  await expect(page.locator('.afl-status')).toContainText(/Archiving record \d+ of 1000: gen-/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.afl-status')).toHaveText('Archiving stopped. Nothing was saved.');
  expect(downloads).toBe(0);
  // Spec 19 F3: Cancel went away; focus is back on the menu that started the archive.
  await expect(page.locator('summary', { hasText: 'Export records' })).toBeFocused();

  const { d, ms } = await archiveFromForm(page);
  const { zip, out } = await unzip(d);
  console.log(`R2 1,000 generated records: ${ms} ms, ${zip.byteLength} bytes, ${out.size} entries`);
  expect([...out.keys()].filter((n) => n.endsWith('.html'))).toHaveLength(1001);
});
