import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { bytes, pick, recordPaths, xsnPath } from './files';

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
  // Chips show short words; the id is the tooltip (and the CSV's).
  const r46 = rowOf(page, '46-vendor-onboarding-code.xsn').locator('.afl-chip');
  await expect(r46).toHaveText(['InfoPath 2013', 'Internal service', 'Code-behind']);
  expect(await r46.evaluateAll((els) => els.map((e) => e.getAttribute('title')))).toEqual([
    'infopath-client',
    'internal-service',
    'code-behind',
  ]);
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
  await expect(causes.nth(0)).toContainText('InfoPath 2013 is out of support');
  await expect(causes.nth(0)).toContainText('July 14, 2026 (last day of extended support)');
  await expect(causes.nth(0)).not.toContainText('6:59:59');
  await expect(causes.nth(0).getByRole('link')).toHaveAttribute(
    'href',
    'https://learn.microsoft.com/en-us/lifecycle/products/infopath-2013',
  );
  await expect(causes.nth(1)).toContainText('internal-service');
  await expect(causes.nth(1)).toContainText('forms-legacy');
  await expect(causes.nth(1)).toContainText('—');
  // A Native submit (davAdapter): the JSM request replaces it, not "rebind".
  await expect(causes.nth(1)).toContainText('The JSM request takes its place');
  await expect(causes.nth(1)).not.toContainText('rebind');
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
  await expect(ax).toContainText(
    "Unsupported: nothing replaces it. The control's class ID is listed so someone can find what it did.",
  );
  await expect(ax).toContainText('view1.xsl › /xsl:stylesheet[1]/xsl:template[1]/');
});

// R4.5: one button on the landing page triages every bundled template.
test('"Triage all samples": 14 forms, wave 1: 2, wave 2: 4, wave 3: 8', async ({ page }) => {
  await page.getByRole('button', { name: 'Triage all samples' }).click();
  const rows = table(page).locator('tbody tr');
  await expect(rows).toHaveCount(14);
  await expect(table(page)).toContainText('14 forms, wave 1: 2, wave 2: 4, wave 3: 8.');
  // Records of forms 01–08 are counted; 43–47 and weight-keeper have none.
  await expect(rowOf(page, '02-expense-report.xsn').locator('td').nth(10)).toHaveText('30');
  await expect(rowOf(page, '44-contract-approval-task.xsn').locator('td').nth(10)).toHaveText('0');
  // Bundled samples show their display name (sample-names.ts).
  await expect(rowOf(page, 'theill__weight-keeper.xsn').getByRole('button')).toHaveText(
    'Weight keeper',
  );
  // Forms 43–47 are in Triage only, not in "Try a sample".
  await page.locator('.afl-menu summary', { hasText: 'Try a sample' }).click();
  await expect(
    page.locator('.afl-menu li button', { hasText: 'Contract approval task' }),
  ).toHaveCount(0);
});

// R7.1: 40 templates (forms 01–08, five copies each under other names), from drop to table.
test('40 templates triage in under 60 s', async ({ page }) => {
  const slugs = [
    '01-leave-request',
    '02-expense-report',
    '03-travel-request',
    '04-purchase-request',
    '05-new-hire-onboarding',
    '06-safety-incident',
    '07-leave-request-v2',
    '08-big-form',
  ];
  const files = [1, 2, 3, 4, 5].flatMap((k) =>
    slugs.map((s) => ({
      name: `copy${k}-${s}.xsn`,
      mimeType: 'application/octet-stream',
      buffer: bytes(xsnPath(s)),
    })),
  );
  const t0 = Date.now();
  await pick(page, files);
  await expect(table(page).locator('tbody tr')).toHaveCount(40, { timeout: 60_000 });
  const ms = Date.now() - t0;
  console.log(`R7.1: 40 templates, drop to table ${ms} ms`);
  expect(ms).toBeLessThan(60_000);
});
