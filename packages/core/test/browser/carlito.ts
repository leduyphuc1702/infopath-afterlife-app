// The Carlito `@font-face` rules for a page that shows renders (spec 03 task 14). InfoPath views
// ask for Calibri (624 of the 638 font declarations in the 53 views), which is on neither macOS
// nor a Linux CI runner. Carlito (SIL Open Font License 1.1, from `@fontsource/carlito`) has
// Calibri's metrics, so declaring it under the family name `Calibri` gives every view InfoPath's
// text widths on any machine. Core does not inline the font: the host page supplies these rules.
// The rules themselves are in `host/carlito.ts`, shared with spec 09's viewer.

import { carlitoCss as carlitoRules } from '../../host/carlito';
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

/** The rules of `host/carlito.ts`, with this package's font files. */
export const carlitoCss = (): string => carlitoRules({ unicode, fileUrl: urlOf });

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
