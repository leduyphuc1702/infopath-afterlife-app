// Spec 09 R3.3, design §7: Calibri resolves to Carlito with GDI line metrics, through the same
// rules as core's visual test (`@afterlife/core/host/carlito`). The rules go in the document, not
// the paper's shadow root: Chromium ignores `@font-face` inside a shadow root.
import { carlitoCss } from '@afterlife/core/host/carlito';
import unicode from '@fontsource/carlito/unicode.json';

const files = import.meta.glob<string>('../../node_modules/@fontsource/carlito/files/*.woff2', {
  query: '?url',
  import: 'default',
  eager: true,
});
const fileUrl = (name: string) => {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}`));
  if (key === undefined) throw new Error(`@fontsource/carlito: no file ${name}`);
  return files[key]!;
};

const STYLES = [
  '10pt Calibri',
  'bold 10pt Calibri',
  'italic 10pt Calibri',
  'italic bold 10pt Calibri',
];

let loaded: Promise<void> | undefined;

/** Adds the rules once and resolves when the four Latin faces the views use have loaded. */
export function loadPaperFonts(doc: Document = document): Promise<void> {
  loaded ??= (async () => {
    const style = doc.createElement('style');
    style.dataset.aflFonts = '';
    style.textContent = carlitoCss({ unicode, fileUrl });
    doc.head.append(style);
    // Latin only (123 KB for the four faces); Latin Extended (336 KB) loads when a form's text needs it.
    const sample = 'Expense Report 0123456789 Åå';
    await Promise.all(STYLES.map((f) => doc.fonts.load(f, sample)));
  })();
  return loaded;
}

/** `U+0100-02BA,U+0304` → code point ranges. */
const parseRanges = (spec: string): (readonly [number, number])[] =>
  spec.split(',').map((r) => {
    const [a, b = a] = r.trim().replace(/^U\+/i, '').split('-') as [string, string?];
    return [parseInt(a, 16), parseInt(b, 16)] as const;
  });
const LATIN = parseRanges(unicode.latin);
const OTHERS = parseRanges(
  Object.entries(unicode as Record<string, string>)
    .filter(([k]) => k !== 'latin')
    .map(([, v]) => v)
    .join(','),
);
const inRanges = (rs: readonly (readonly [number, number])[], c: number) =>
  rs.some(([a, b]) => c >= a && c <= b);

/**
 * Design D7: the warm-up loads the Latin faces only. When a render uses characters that only
 * another Carlito subset covers, the browser loads that face on demand; offline it cannot, and
 * the text falls back to a system font. Resolves true when that happened.
 */
export async function onDemandFacesFailed(
  text: string,
  doc: Document = document,
): Promise<boolean> {
  const chars = [...new Set(text)]
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return !inRanges(LATIN, c) && inRanges(OTHERS, c);
    })
    .join('');
  if (chars === '') return false;
  try {
    const faces = (await Promise.all(STYLES.map((f) => doc.fonts.load(f, chars)))).flat();
    return faces.some((f) => f.status === 'error');
  } catch {
    return true;
  }
}
