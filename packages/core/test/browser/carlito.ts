// The Carlito `@font-face` rules for a page that shows renders (spec 03 task 14). InfoPath views
// ask for Calibri (624 of the 638 font declarations in the 53 views), which is on neither macOS
// nor a Linux CI runner. Carlito (SIL Open Font License 1.1, from `@fontsource/carlito`) has
// Calibri's metrics, so declaring it under the family name `Calibri` gives every view InfoPath's
// text widths on any machine. Core does not inline the font: the host page supplies these rules.
// Spec 09's viewer ships the same rules.

import unicode from '@fontsource/carlito/unicode.json';

/** Every woff2 file of the package, by file name, as a URL Vite serves. */
const files = import.meta.glob<string>('../../node_modules/@fontsource/carlito/files/*.woff2', {
  query: '?url',
  import: 'default',
  eager: true,
});
const urlOf = (name: string) => {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}`));
  if (key === undefined) throw new Error(`@fontsource/carlito: no file ${name}`);
  return files[key]!;
};

/**
 * InfoPath's line heights (spec 03 design §8.1 step 9): GDI rounds the em to whole pixels and
 * rounds ascent and descent separately, so 10pt Calibri (win metrics 1950/550 per 2048) is
 * 12 + 3 = 15 px. Chromium's fractional em gives 13 + 4 = 17. These descriptors give 12 + 3 at
 * 10pt, and match GDI at 9pt, 12pt and 16pt too. The font files are unchanged.
 */
const METRICS = 'ascent-override:93%;descent-override:26%;line-gap-override:0%';

/** One rule per subset, weight (400, 700) and style (normal, italic): 28 rules. */
export function carlitoCss(): string {
  const rules: string[] = [];
  for (const [subset, range] of Object.entries(unicode as Record<string, string>)) {
    for (const weight of [400, 700]) {
      for (const style of ['normal', 'italic']) {
        const url = urlOf(`carlito-${subset}-${weight}-${style}.woff2`);
        rules.push(
          `@font-face{font-family:Calibri;font-style:${style};font-weight:${weight};` +
            `font-display:block;src:url(${JSON.stringify(url)}) format("woff2");unicode-range:${range};` +
            `${METRICS}}`,
        );
      }
    }
  }
  return rules.join('\n');
}

/** Adds the rules to the page and waits until the four faces used by the views have loaded. */
export async function loadCarlito(): Promise<void> {
  const style = document.createElement('style');
  style.textContent = carlitoCss();
  document.head.append(style);
  const sample = 'Expense Report — Claim 0123456789 $,./ ĐđÅå';
  for (const font of [
    '10pt Calibri',
    'bold 10pt Calibri',
    'italic 10pt Calibri',
    'italic bold 10pt Calibri',
  ]) {
    await document.fonts.load(font, sample);
  }
  await document.fonts.ready;
  const loaded = [...document.fonts].filter((f) => f.family === 'Calibri' && f.status === 'loaded');
  if (loaded.length < 4)
    throw new Error(`Carlito: ${loaded.length} Calibri faces loaded, expected 4 or more`);
}
