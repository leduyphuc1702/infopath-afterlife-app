// Host helper, not core API (spec 09 D3; `@afterlife/core/host/carlito`): the Carlito
// `@font-face` rules for a page that shows renders. InfoPath views ask for Calibri (624 of the 638
// font declarations in the 53 views), which is on neither macOS nor a Linux CI runner. Carlito
// (SIL Open Font License 1.1, from `@fontsource/carlito`) has Calibri's metrics, so declaring it
// under the family name `Calibri` gives every view InfoPath's text widths on any machine. Core
// does not inline the font: the host page supplies the package's `unicode.json` and a URL for
// each woff2 file, and adds these rules. Core's visual test and the web viewer share this file.

/**
 * InfoPath's line heights (spec 03 design §8.1 step 9): GDI rounds the em to whole pixels and
 * rounds ascent and descent separately, so 10pt Calibri (win metrics 1950/550 per 2048) is
 * 12 + 3 = 15 px. Chromium's fractional em gives 13 + 4 = 17. These descriptors give 12 + 3 at
 * 10pt, and match GDI at 9pt, 12pt and 16pt too. The font files are unchanged.
 */
export const CARLITO_METRICS = 'ascent-override:93%;descent-override:26%;line-gap-override:0%';

export interface CarlitoSources {
  /** `@fontsource/carlito/unicode.json`: subset name → `unicode-range` value. */
  readonly unicode: Readonly<Record<string, string>>;
  /** The URL the page serves for a file such as `carlito-latin-400-normal.woff2`. */
  readonly fileUrl: (fileName: string) => string;
}

/** One rule per subset, weight (400, 700) and style (normal, italic): 28 rules. */
export function carlitoCss({ unicode, fileUrl }: CarlitoSources): string {
  const rules: string[] = [];
  for (const [subset, range] of Object.entries(unicode)) {
    for (const weight of [400, 700]) {
      for (const style of ['normal', 'italic']) {
        const url = fileUrl(`carlito-${subset}-${weight}-${style}.woff2`);
        rules.push(
          `@font-face{font-family:Calibri;font-style:${style};font-weight:${weight};` +
            `font-display:block;src:url(${JSON.stringify(url)}) format("woff2");unicode-range:${range};` +
            `${CARLITO_METRICS}}`,
        );
      }
    }
  }
  return rules.join('\n');
}
