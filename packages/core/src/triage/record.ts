// Spec 12 R6.2, design D4: what a record says about its template's causes, from its first 4 KB
// with no DOM (as `matchRecord` reads the solution instruction). Today that is one thing: an
// `xml-stylesheet` instruction, which a browser would run as XSLT.
import { headText } from '../xsn/package';
import type { Located } from '../unknown';

export interface RecordEvidence {
  readonly fileName: string;
  /** Where the `xml-stylesheet` instruction is, when the record has one. */
  readonly stylesheet?: Located;
}

export function recordEvidence(fileName: string, bytes: Uint8Array): RecordEvidence {
  const text = headText(bytes);
  const m = /<\?xml-stylesheet\b/.exec(text);
  if (!m) return { fileName };
  const before = text.slice(0, m.index);
  const line = before.split('\n').length;
  const column = m.index - before.lastIndexOf('\n');
  return {
    fileName,
    stylesheet: {
      file: fileName,
      path: '/processing-instruction(xml-stylesheet)[1]',
      line,
      column,
    },
  };
}
