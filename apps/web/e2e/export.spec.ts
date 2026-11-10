import { readdirSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { OWN, pick, xsnPath } from './files';

// Spec 12 R5.1, R5.2: "Export plan" → CSV (a download made in the browser: no request, no
// violation, under the guards) and the print view on one page in A4 and in Letter, for all
// 47 own forms.
const ALL = readdirSync(new URL('xsn/', OWN))
  .filter((f) => f.endsWith('.xsn'))
  .sort()
  .map((f) => f.slice(0, -4));

async function openAll(page: Page) {
  await page.goto('./');
  await pick(page, ALL.map(xsnPath));
  await expect(page.getByRole('region', { name: 'Triage' }).locator('tbody tr')).toHaveCount(47);
}

test('CSV: one row per form, ids in the causes column, Emulated in the header', async ({
  page,
  context,
}) => {
  await openAll(page);
  const requested: string[] = [];
  context.on('request', (r) => requested.push(r.url()));
  await page.getByText('Export plan').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('afterlife-migration-plan.csv');
  const text = readFileSync(await download.path(), 'utf8');
  const lines = text.trimEnd().split('\r\n');
  expect(lines).toHaveLength(48);
  expect(lines[0]).toContain('Emulated');
  expect(lines.find((l) => l.startsWith('46-'))).toContain(
    'infopath-client internal-service code-behind',
  );
  // The download is a blob: URL; the guards already fail the test on any other origin.
  expect(requested.filter((u) => !u.startsWith('blob:'))).toEqual([]);
});

for (const format of ['A4', 'Letter'] as const)
  test(`print view: one ${format} page with totals, waves, top causes and the rules`, async ({
    page,
  }) => {
    await openAll(page);
    await page.emulateMedia({ media: 'print' });
    const plan = page.locator('.afl-print');
    await expect(plan).toBeVisible();
    await expect(plan).toContainText('47 forms');
    await expect(plan).toContainText('Wave 1: everything converts');
    await expect(plan.locator('ol li')).toHaveCount(5);
    await expect(plan.locator('ol li').first()).toHaveText(
      'InfoPath 2013 is out of support (infopath-client): 47 forms',
    );
    const pdf = await page.pdf({ format, printBackground: true });
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages).toHaveLength(1);
  });
