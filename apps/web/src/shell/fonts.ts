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
    await Promise.all(
      ['10pt Calibri', 'bold 10pt Calibri', 'italic 10pt Calibri', 'italic bold 10pt Calibri'].map(
        (f) => doc.fonts.load(f, sample),
      ),
    );
  })();
  return loaded;
}
