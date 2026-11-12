// The first screen and the icon buttons. Not written by Kiro (README, "What Kiro did not write").
import { expect, test } from './fixtures';

test('an explanation stays behind its help icon until it is asked for', async ({ page }) => {
  await page.goto('./');
  const help = page.getByRole('button', { name: 'About InfoPath Afterlife' });
  const tip = page.locator('.afl-lead [role="tooltip"]');
  await expect(tip).toBeHidden();

  await help.hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('July 14, 2026');
  // WCAG 1.4.13: the pointer can move onto the explanation without it closing.
  await tip.hover();
  await expect(tip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();

  await help.focus();
  await expect(tip).toBeVisible();
  await expect(help).toHaveAccessibleDescription(/July 14, 2026/);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(help).toBeFocused();
});

test('the first screen asks for one thing and reads nothing aloud twice', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.afl-landing > p')).toHaveCount(1);
  await expect(page.locator('.afl-landing [role="tooltip"]:visible')).toHaveCount(0);
  await expect(page.locator('.afl-landing .afl-primary')).toHaveText('Choose files');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose files' }).click();
  await chooser;
});

test('at 390 px the first screen fits and an explanation stays on the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const name of ['About InfoPath Afterlife', 'Which files', 'What this does']) {
    const help = page.getByRole('button', { name, exact: true });
    await help.focus();
    const tip = page.locator('[role="tooltip"]:visible');
    await expect(tip).toHaveCount(1);
    const box = (await tip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await help.blur();
  }
});

test('an icon button keeps its name and shows it on hover', async ({ page }) => {
  await page.goto('./#fill');
  for (const name of ['Open files', 'Documentation', 'Previous', 'Next', 'Undo', 'Redo']) {
    const button = page.getByRole('button', { name, exact: name !== 'Undo' && name !== 'Redo' });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('title', new RegExp(`^${name}`));
    const box = (await button.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(40);
  }
});

test('at 320 px the documentation tools wrap and "Back" stays on one line', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('./#document');
  const back = page.locator('.afl-doc-tools').getByRole('button', { name: 'Back' });
  const box = (await back.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
