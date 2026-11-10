// Bytes → text for every XML document (design §7.2 step 1, D11; R5.3). The XML parser takes a
// string and ignores the `encoding` declaration, so this module owns encodings.

import { AfterlifeError, type Issue } from '../errors';
import { REFUSED_ENCODINGS } from './refused-encodings';

export interface Decoded {
  readonly text: string;
  /** Canonical WHATWG name actually used, e.g. `utf-8`, `windows-1251`. */
  readonly encoding: string;
  /** `INVALID_ENCODING` when bytes were replaced by U+FFFD. */
  readonly issues: readonly Issue[];
}

/** How far into the document the XML declaration's `encoding` is looked for. */
const DECLARATION_WINDOW = 1024;

export function decode(bytes: Uint8Array, file: string): Decoded {
  const sniffed = sniff(bytes);
  let encoding: string;
  if (sniffed) {
    // A BOM or the UTF-16 byte pattern wins over any declaration.
    encoding = sniffed;
  } else {
    const declared = declaredEncoding(bytes);
    encoding = declared ? canonical(declared.label, declared.column, file) : 'utf-8';
    // ASCII-compatible bytes cannot be UTF-16, whatever the declaration says.
    if (encoding === 'utf-16le' || encoding === 'utf-16be') encoding = 'utf-8';
  }

  try {
    return { text: new TextDecoder(encoding, { fatal: true }).decode(bytes), encoding, issues: [] };
  } catch {
    // Damaged bytes: decode with U+FFFD so the file still opens, and say so.
    const text = new TextDecoder(encoding).decode(bytes);
    return {
      text,
      encoding,
      issues: [
        {
          code: 'INVALID_ENCODING',
          message: `${file} has bytes that are not valid ${encoding}; they were replaced with U+FFFD`,
          file,
          details: { encoding },
        },
      ],
    };
  }
}

/** UTF-8/16 from a BOM, or UTF-16 from the bytes of `<?` (XML 1.0 Appendix F). */
function sniff(b: Uint8Array): string | undefined {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
  if (b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  if (b[0] === 0xfe && b[1] === 0xff) return 'utf-16be';
  if (b[0] === 0x3c && b[1] === 0x00 && b[2] === 0x3f && b[3] === 0x00) return 'utf-16le';
  if (b[0] === 0x00 && b[1] === 0x3c && b[2] === 0x00 && b[3] === 0x3f) return 'utf-16be';
  return undefined;
}

/** The `encoding` pseudo-attribute of an XML declaration at byte 0, read as ASCII. */
function declaredEncoding(b: Uint8Array): { label: string; column: number } | undefined {
  const head = String.fromCharCode(...b.subarray(0, DECLARATION_WINDOW));
  if (!head.startsWith('<?xml')) return undefined;
  const end = head.indexOf('?>');
  const decl = end < 0 ? head : head.slice(0, end);
  const m = /\sencoding\s*=\s*(["'])([^"']*)\1/.exec(decl);
  if (!m) return undefined;
  return { label: m[2]!, column: m.index + m[0].indexOf(m[1]!) + 2 };
}

function canonical(label: string, column: number, file: string): string {
  let encoding: string;
  try {
    // Unknown labels and the six `replacement` labels throw RangeError (WHATWG Encoding).
    encoding = new TextDecoder(label).encoding;
  } catch {
    throw new AfterlifeError('INVALID_XML', { file, line: 1, column, encoding: label });
  }
  if (REFUSED_ENCODINGS.includes(encoding)) {
    throw new AfterlifeError('INVALID_XML', { file, line: 1, column, encoding: label });
  }
  return encoding;
}
