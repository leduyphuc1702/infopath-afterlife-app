// Spec 16: the dossier on the page (K1, K5, K7, K8, K12), an honest open (K13), spec 14's N1–N3,
// and spec 04's criteria that had no test (R5.3, R5.4, R6.1). Each failed before its fix.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { pick, recordPaths, xsnPath } from './files';

const fillSwitch = (page: Page) => page.getByRole('switch', { name: 'Fill' });
const paper = (page: Page) => page.locator('[data-afl-paper]');
const shadowActive = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-afl-paper]')?.shadowRoot?.activeElement as
      HTMLElement | null | undefined;
    return el
      ? { path: el.dataset.aflPath, invalid: el.classList.contains('afl-invalid') }
      : undefined;
  });
const renders = (page: Page) => paper(page).getAttribute('data-afl-renders').then(Number);

async function sample(page: Page, name: RegExp) {
  await page.goto('./');
  await page.getByRole('button', { name }).first().click();
  await expect(page.locator('.afl-root')).toBeVisible();
}
async function fillOn(page: Page) {
  await fillSwitch(page).click();
  await expect(fillSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-afl-paper][data-afl-renders]')).toBeVisible();
}
async function documentation(page: Page) {
  await sample(page, /^Purchase request/);
  await page.getByRole('button', { name: 'Documentation' }).click();
  await expect(page.locator('#afl-doc-h')).toBeFocused();
}

test('K1: at 390 px the dossier does not scroll sideways and each field reads as a block', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await documentation(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const widths = await page
    .locator('.afl-doc-fields tbody code')
    .evaluateAll((cs) => cs.map((c) => c.getBoundingClientRect().width));
  expect(Math.min(...widths)).toBeGreaterThan(120);
});

test('K5: the dossier prints in flowing sections, not a page per section', async ({ page }) => {
  await documentation(page);
  await page.emulateMedia({ media: 'print' });
  const doc = page.locator('.afl-doc');
  expect(
    await doc.locator('section').evaluateAll((s) => s.map((x) => getComputedStyle(x).breakBefore)),
  ).toEqual(['auto', 'auto', 'auto', 'auto', 'auto', 'auto']);
  expect(
    await doc
      .locator('h3, h4')
      .evaluateAll((s) => [...new Set(s.map((x) => getComputedStyle(x).breakAfter))]),
  ).toEqual(['avoid']);
  expect(
    await doc
      .locator('li, tr')
      .evaluateAll((s) => [...new Set(s.map((x) => getComputedStyle(x).breakInside))]),
  ).toEqual(['avoid']);
  const pdf = (await page.pdf({ format: 'A4' })).toString('latin1');
  const pages = pdf.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
  console.log(`K5: form 04 dossier prints on ${pages} A4 pages`);
  expect(pages).toBeLessThanOrEqual(4);
});

test('K12: Tab from the heading goes to the screen’s own buttons', async ({ page }) => {
  await documentation(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeFocused();
});

test('K7, K8: both downloads say what they saved; Triage shows the button, focus stays', async ({
  page,
}) => {
  await documentation(page);
  const md = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown' }).click();
  await md;
  await expect(page.locator('.afl-status')).toHaveText(
    'Saved 04-purchase-request-documentation.md.',
  );

  await page.goto('./');
  await expect(page.locator('html[data-ready]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Triage all samples' }).click();
  await expect(page.locator('.afl-triage tbody tr')).toHaveCount(48);
  const button = page.getByRole('button', { name: 'Download documentation' });
  await expect(button).toBeVisible();
  const zip = page.waitForEvent('download');
  await button.click();
  await zip;
  await expect(page.locator('.afl-status')).toContainText('Saved form-documentation.zip');
  await expect(button).toBeFocused();
});

test('K13: opening a record whose stored values disagree with its formulas says so', async ({
  page,
}) => {
  await sample(page, /^Purchase request/);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.afl-position')).toContainText('04-purchase-request-004.xml');
  await fillOn(page);
  await expect(page.locator('.afl-status')).toContainText(
    '2 values stored in this record differ from the form’s own formulas; the form’s values are shown.',
  );
  await page.getByRole('tab', { name: 'Rule Trace' }).click();
  await expect(page.locator('.afl-trace-entry').first()).toContainText(
    'does not match the form’s formula',
  );
});

test('N1: the Rule Trace says a step was undone', async ({ page }) => {
  await sample(page, /^Expense report/);
  await fillOn(page);
  const amount = paper(page).locator('[data-afl-path$="/my:expense[1]/my:amount[1]"]').first();
  const before = await renders(page);
  await amount.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('7');
  await page.keyboard.press('Enter');
  await expect.poll(() => renders(page)).toBeGreaterThan(before);
  await page.getByRole('button', { name: /^Undo/ }).click();
  await page.getByRole('tab', { name: 'Rule Trace' }).click();
  await expect(page.locator('.afl-trace-entry').first()).toContainText(
    /^.*Undo: Amount in row 1 is back to 55\.39/,
  );
});

test('N2: Export records while filling says what it saved', async ({ page }) => {
  await sample(page, /^Expense report/);
  await fillOn(page);
  const dl = page.waitForEvent('download');
  await page.locator('summary', { hasText: 'Export records' }).click();
  await page.getByRole('button', { name: 'Excel workbook (.xlsx)' }).click();
  await dl;
  await expect(page.locator('.afl-status')).toContainText('Exported');
});

test('N3: "Insert item" does not print, in read mode and in Fill', async ({ page }) => {
  await sample(page, /^Expense report/);
  const shown = () =>
    paper(page).evaluate((p) =>
      [...(p.shadowRoot?.querySelectorAll('[data-afl-structure="insert"]') ?? [])].map(
        (e) => getComputedStyle(e).display,
      ),
    );
  await page.emulateMedia({ media: 'print' });
  expect(await shown()).not.toEqual([]);
  expect(new Set(await shown())).toEqual(new Set(['none']));
  await page.emulateMedia({ media: 'screen' });
  await fillOn(page);
  await page.emulateMedia({ media: 'print' });
  expect(new Set(await shown())).toEqual(new Set(['none']));
});

test('R5.3, R5.4: next and previous error focus each invalid field; download says how many are left', async ({
  page,
}) => {
  await page.goto('./');
  await pick(page, [xsnPath('10-timesheet'), ...recordPaths('10-timesheet', 1)]);
  await fillOn(page);
  const count = Number(
    /^(\d+)/.exec((await page.locator('.afl-attention span').textContent()) ?? '')?.[1],
  );
  expect(count).toBeGreaterThan(0);
  const seen: string[] = [];
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: 'Next error' }).click();
    const a = await shadowActive(page);
    expect(a?.invalid).toBe(true);
    seen.push(a!.path!);
  }
  expect(new Set(seen).size).toBe(count);
  await page.getByRole('button', { name: 'Next error' }).click();
  expect((await shadowActive(page))?.path).toBe(seen[0]);
  await page.getByRole('button', { name: 'Previous error' }).click();
  expect((await shadowActive(page))?.path).toBe(seen.at(-1));

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download XML' }).click();
  await dl;
  await expect(page.locator('.afl-status')).toContainText(
    `${count} ${count === 1 ? 'field still needs' : 'fields still need'} attention.`,
  );
});

test('R6.1: CheckBox, OptionButton and RichText with Enter and Ctrl+Enter', async ({ page }) => {
  const undo = page.getByRole('button', { name: /^Undo/ });
  await sample(page, /^Travel request/);
  await fillOn(page);
  const visa = paper(page).locator('[data-afl-path$="/my:visaRequired[1]"]').first();
  const was = await visa.isChecked();
  let n = await renders(page);
  await visa.click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  expect(
    await paper(page).locator('[data-afl-path$="/my:visaRequired[1]"]').first().isChecked(),
  ).toBe(!was);
  await expect(undo).toBeEnabled();

  await sample(page, /^Leave request/);
  await fillOn(page);
  const radios = paper(page).locator('[data-afl-path$="/my:leaveType[1]"]');
  const target = (await radios.nth(0).isChecked()) ? 1 : 0;
  n = await renders(page);
  await radios.nth(target).click();
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(
    paper(page).locator('[data-afl-path$="/my:leaveType[1]"]').nth(target),
  ).toBeChecked();

  await sample(page, /^Safety incident/);
  await fillOn(page);
  const box = paper(page).locator('[data-afl-path$="/my:incidentDescription[1]"]').first();
  await box.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await expect(undo).toBeDisabled();
  n = await renders(page);
  await page.keyboard.press('Control+Enter');
  await expect.poll(() => renders(page)).toBeGreaterThan(n);
  await expect(undo).toBeEnabled();
  await expect(
    paper(page).locator('[data-afl-path$="/my:incidentDescription[1]"]').first(),
  ).toHaveText(/first\s*second/);
});
