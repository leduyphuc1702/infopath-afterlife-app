// Spec 23: the accessibility pass, and what spec 22 left (H1–H3).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const position = (page: Page) => page.locator('.afl-position');

/** Contrast of an element's background against what is drawn behind it (alpha composited). */
const contrastOn = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => {
      const parse = (c: string) => {
        const m = c.match(/[\d.]+/g)!.map(Number);
        return { r: m[0]!, g: m[1]!, b: m[2]!, a: m[3] ?? 1 };
      };
      const behind = (start: Element | null) => {
        const layers: ReturnType<typeof parse>[] = [];
        for (let e = start; e; e = e.parentElement) {
          const c = parse(getComputedStyle(e).backgroundColor);
          if (c.a > 0) layers.push(c);
          if (c.a === 1) break;
        }
        let out = { r: 255, g: 255, b: 255 };
        for (const l of layers.reverse())
          out = {
            r: l.r * l.a + out.r * (1 - l.a),
            g: l.g * l.a + out.g * (1 - l.a),
            b: l.b * l.a + out.b * (1 - l.a),
          };
        return out;
      };
      const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const own = parse(getComputedStyle(el).backgroundColor);
      const back = behind(el.parentElement);
      const fg = {
        r: own.r * own.a + back.r * (1 - own.a),
        g: own.g * own.a + back.g * (1 - own.a),
        b: own.b * own.a + back.b * (1 - own.a),
      };
      const [hi, lo] = [lum(fg), lum(back)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    });

const TASKS: Record<string, (page: Page) => Promise<void>> = {
  read: (page) => expect(position(page)).toContainText('-001.xml'),
  rules: (page) => expect(position(page)).toContainText('-001.xml'),
  fill: (page) => expect(position(page)).toContainText('-001.xml'),
  keep: (page) => expect(position(page)).toContainText('-001.xml'),
  find: (page) => expect(page.locator('#afl-records-h')).toBeVisible(),
  document: (page) => expect(page.locator('#afl-doc-h')).toBeVisible(),
  triage: (page) => expect(page.locator('#afl-triage-h')).toBeVisible(),
};

for (const [id, check] of Object.entries(TASKS))
  test(`H1: ${id}: Forward shows what Back left, adds no entry, keeps the address`, async ({
    page,
  }) => {
    await page.goto('./');
    await page.locator(`.afl-tasks a[href="#${id}"]`).click();
    await check(page);
    await expect(page.locator('.afl-hint')).toBeVisible();
    const entries = await page.evaluate(() => history.length);
    await page.goBack();
    await expect(page.locator('#afl-tasks-h')).toBeFocused();
    await page.goForward();
    await check(page);
    await expect(page.locator('.afl-hint')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    expect(await page.evaluate(() => history.length)).toBe(entries);
    await page.goBack();
    await expect(page.locator('#afl-tasks-h')).toBeFocused();
  });

async function typed(page: Page) {
  await page.goto('./#fill');
  await expect(page.getByRole('tab', { name: 'Rule Trace' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.locator('[data-afl-paper] [title="Qty"]').first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('9');
}

test('H2: a value typed and not yet left is kept, and Back asks', async ({ page }) => {
  await typed(page);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Discard your changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep filling' }).click();
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeEnabled();
});

test('H2: Next clicked straight after typing asks', async ({ page }) => {
  await typed(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Discard your changes?' })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const)
  test(`H3: the summary's bars are 3:1 against their line, chosen or not (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#find');
    await page.getByRole('button', { name: 'Summarize' }).click();
    await page.locator('.afl-summary-table').getByRole('button', { name: 'Euro' }).click();
    expect(await contrastOn(page, '.afl-summary-picked .afl-summary-bar')).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      await contrastOn(
        page,
        '.afl-summary-table tbody tr:not(.afl-summary-picked) .afl-summary-bar',
      ),
    ).toBeGreaterThanOrEqual(3);
  });

test('B4: every field in Fill has a name; the date picker’s dead button is out of the way', async ({
  page,
}) => {
  await page.goto('./#fill');
  await expect(page.locator('.afl-hint')).toBeVisible();
  const r = await page.locator('[data-afl-paper]').evaluate((host) => {
    const root = host.shadowRoot!;
    return {
      nameless: [...root.querySelectorAll('[data-afl-ctrl]')].filter(
        (e) => !e.getAttribute('aria-label'),
      ).length,
      dead: [...root.querySelectorAll<HTMLElement>('button.xdDTButton')].filter(
        // Spec 24 W2: the calendar button works now; in the tab order it must have a name.
        (b) =>
          b.tabIndex >= 0 &&
          b.getAttribute('aria-hidden') !== 'true' &&
          !b.getAttribute('aria-label'),
      ).length,
    };
  });
  expect(r).toEqual({ nameless: 0, dead: 0 });
  await expect(
    page.locator('[data-afl-paper]').getByRole('textbox', { name: 'Needed by' }),
  ).toBeVisible();
});

test('B5: on a small screen the paper and the records list scroll from the keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('./#read');
  await expect(page.locator('.afl-hint')).toBeVisible();
  const frame = page.getByRole('region', { name: /^Expense Report, Claim view/ });
  await frame.focus();
  await expect(frame).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => frame.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
  await page.goto('./#find');
  const box = page.getByRole('region', { name: 'Records found' });
  await box.focus();
  await expect(box).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => box.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
});

test('B6: with forced colours, pressed, selected and chosen still show', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('./#rules');
  await expect(page.locator('.afl-hint')).toBeVisible();
  const look = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => {
        const s = getComputedStyle(e);
        return `${s.backgroundColor} ${s.color} ${s.borderBottomWidth} ${s.borderBottomColor} ${s.borderLeftWidth} ${s.borderLeftColor}`;
      });
  // Both buttons' backgrounds are drawn in the system's Canvas colour; the text colour must differ.
  const ink = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => getComputedStyle(e).color);
  expect(await ink('.afl-toggle[aria-pressed="true"]')).not.toBe(
    await ink('.afl-toggle[aria-pressed="false"], .afl-toggle[aria-checked="false"]'),
  );
  expect(await look('.afl-tab[aria-selected="true"]')).not.toBe(
    await look('.afl-tab[aria-selected="false"]'),
  );
  await page.goto('./#find');
  await page.getByRole('button', { name: 'Summarize' }).click();
  await page.locator('.afl-summary-table').getByRole('button', { name: 'Euro' }).click();
  expect(await look('.afl-summary-picked th')).not.toBe(
    await look('.afl-summary-table tbody tr:not(.afl-summary-picked) th'),
  );
});

test('B7: the Documentation’s fields table has a name', async ({ page }) => {
  await page.goto('./#document');
  await expect(page.getByRole('table', { name: 'Fields' })).toBeVisible();
});
