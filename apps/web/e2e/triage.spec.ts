import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { pick, recordPaths, xsnPath } from './files';

// Spec 12 R4.1–R4.3, R6.1, R2.3: Triage after opening several templates, the Wave rules by
// keyboard, and death certificates.
const FOUR = [
  '01-leave-request',
  '04-purchase-request',
  '44-contract-approval-task',
  '46-vendor-onboarding-code',
];
const table = (page: Page) => page.getByRole('region', { name: 'Triage' });
const rowOf = (page: Page, file: string) =>
  table(page).locator('tbody tr').filter({ hasText: file });

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('four templates: one row each; no records opened means "—", not 0', async ({ page }) => {
  await pick(page, FOUR.map(xsnPath));
  const rows = table(page).locator('tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(table(page)).toContainText('4 forms, wave 1: 0, wave 2: 0, wave 3: 4.');
  for (let i = 0; i < 4; i++) await expect(rows.nth(i).locator('td').nth(10)).toHaveText('—');
  const r46 = rowOf(page, '46-vendor-onboarding-code.xsn').locator('.afl-chip');
  await expect(r46).toHaveText(['infopath-client', 'internal-service', 'code-behind']);
  // Triage has no paper and no X-ray switch.
  await expect(page.getByRole('button', { name: 'X-ray' })).toHaveCount(0);
  await expect(page.locator('[data-afl-paper]')).toHaveCount(0);
});

test('records opened with the templates are counted; a damaged template is an error row', async ({
  page,
}) => {
  await pick(page, [
    xsnPath('01-leave-request'),
    xsnPath('05-new-hire-onboarding'),
    ...recordPaths('05-new-hire-onboarding', 3),
    { name: 'broken.xsn', mimeType: 'application/octet-stream', buffer: Buffer.from('MSCF') },
  ]);
  const rows = table(page).locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rowOf(page, '05-new-hire-onboarding.xsn').locator('td').nth(10)).toHaveText('3');
  await expect(rowOf(page, '01-leave-request.xsn').locator('td').nth(10)).toHaveText('0');
  await expect(rows.nth(2)).toContainText("We couldn't open broken.xsn.");
});

test('R4.2: the Wave rules are reachable by keyboard', async ({ page }) => {
  await pick(page, FOUR.slice(0, 2).map(xsnPath));
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeHidden();
  const wave = page.getByRole('button', { name: 'Wave' });
  await wave.focus();
  await expect(tip).toBeVisible();
  await expect(wave).toHaveAccessibleDescription(
    /Wave 1: everything converts.*Wave 3: at least one part/,
  );
});

test("R4.3: form 46's certificate, then its form, then back to Triage", async ({ page }) => {
  await pick(page, FOUR.map(xsnPath));
  await rowOf(page, '46-vendor-onboarding-code.xsn').getByRole('button').click();
  const cert = page.getByRole('region', { name: /^Death certificate:/ });
  const causes = cert.getByRole('article');
  await expect(causes).toHaveCount(3);
  await expect(causes.nth(0)).toContainText('infopath-client');
  await expect(causes.nth(0)).toContainText('after July 14, 2026');
  await expect(causes.nth(0).getByRole('link')).toHaveAttribute(
    'href',
    'https://learn.microsoft.com/en-us/lifecycle/products/infopath-2013',
  );
  await expect(causes.nth(1)).toContainText('internal-service');
  await expect(causes.nth(1)).toContainText('forms-legacy');
  await expect(causes.nth(1)).toContainText('—');
  await expect(causes.nth(2)).toContainText('code-behind');
  await expect(causes.nth(2)).toContainText('Manual: the logic must be rewritten by hand.');
  await expect(causes.nth(2)).not.toContainText('Unsupported');
  await expect(cert).toContainText(
    'Workflows attached outside the form cannot be detected from the file. Ask the library owner.',
  );
  await cert.getByRole('button', { name: 'Open form' }).click();
  await expect(page.locator('[data-afl-paper]')).toBeAttached();
  await expect(page.getByRole('toolbar', { name: 'Views and records' })).toBeVisible();
  await page.getByRole('button', { name: 'Triage' }).click();
  await expect(table(page).locator('tbody tr')).toHaveCount(4);
});

test('form 44: ActiveX is Unsupported; view paths use the usual prefixes', async ({ page }) => {
  await pick(page, FOUR.map(xsnPath));
  await rowOf(page, '44-contract-approval-task.xsn').getByRole('button').click();
  const cert = page.getByRole('region', { name: /^Death certificate:/ });
  await expect(cert.getByRole('article')).toHaveCount(2);
  const ax = cert.getByRole('article', { name: /ActiveX control/ });
  await expect(ax).toContainText('Unsupported: listed');
  await expect(ax).toContainText('view1.xsl › /xsl:stylesheet[1]/xsl:template[1]/');
});
