// Spec 15: the form dossier on the page. From the form and from a death certificate, Back,
// print without the app around it, Download Markdown, and the Triage zip.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('R3.1–R3.3: from the form, Back, print, Download Markdown', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Purchase request/ }).click();
  await expect(page.locator('.afl-form-name')).toHaveText('Purchase Request');
  await page.getByRole('button', { name: 'Documentation' }).click();
  const h = page.getByRole('heading', { name: 'Purchase Request: form documentation' });
  await expect(h).toBeFocused();
  await expect(page).toHaveTitle(/^Documentation: Purchase Request/);
  const doc = page.locator('.afl-doc');
  await expect(doc.locator('dl')).toContainText('Records loaded20');
  await expect(doc).toContainText(
    // Spec 16 K2: the button by its caption, not its control id.
    'Rule “Over 1000 needs accounting approval” runs when the button “Check approval” on view “Request” is pressed',
  );
  await expect(doc.locator('.afl-doc-expr').first()).toBeVisible();
  const headings = await doc.locator('h3').allTextContents();
  expect(headings).toEqual([
    'What the form is',
    'Fields',
    'Logic',
    'Data connections',
    'What depends on what',
    'What could not be read',
  ]);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.afl-header')).toBeHidden();
  await expect(page.locator('.afl-footer')).toBeHidden();
  await expect(page.locator('.afl-doc-tools')).toBeHidden();
  expect(
    await doc.locator('section').evaluateAll((s) => s.map((x) => getComputedStyle(x).breakBefore)),
    // Spec 16 K5: sections flow; a page per section wasted paper.
  ).toEqual(['auto', 'auto', 'auto', 'auto', 'auto', 'auto']);
  await page.emulateMedia({ media: 'screen' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('04-purchase-request-documentation.md');
  const md = readFileSync(await d.path(), 'utf8');
  expect(md.split('\n')[0]).toBe('# Purchase Request: form documentation');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.afl-form-name')).toHaveText('Purchase Request');
});

test('R3.1, R3.3: from a death certificate; Triage downloads every form as a zip', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('html[data-ready]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Triage all samples' }).click();
  await expect(page.locator('.afl-triage tbody tr')).toHaveCount(48);

  const download = page.waitForEvent('download');
  await page.locator('.afl-export summary').click();
  await page.getByRole('button', { name: 'Download documentation' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('form-documentation.zip');
  // Names as stored (the Worker test reads the same zip back with core's reader).
  const zip = readFileSync(await d.path()).toString('latin1');
  expect(zip.startsWith('PK\x03\x04')).toBe(true);
  const names = [...new Set(zip.match(/[\w.-]+-documentation\.md|index\.md/g))];
  expect(names[0]).toBe('index.md');
  expect(names.filter((n) => n.endsWith('-documentation.md'))).toHaveLength(48);

  await page.locator('[data-afl-cert]').first().click();
  await page.getByRole('button', { name: 'Documentation' }).click();
  await expect(page.locator('#afl-doc-h')).toBeFocused();
  await page.goBack();
  await expect(page.locator('#afl-cert-h')).toBeVisible();
});
