// One linear pass over a decoded XML document before it is parsed (design §7.2 step 3):
// - a document type declaration anywhere outside a comment or CDATA → UNSAFE_XML (R5.2);
// - element nesting deeper than `maxDepth` → LIMIT_EXCEEDED xmlDepth (R4.5), because the XML
//   parser has no depth limit of its own.
// States: text, tag (with quoted attribute values), comment, CDATA, processing instruction,
// other markup declaration. Well-formedness is left to the parser.

import { AfterlifeError } from '../errors';

const LT = 0x3c; // <
const GT = 0x3e; // >
const SLASH = 0x2f; // /
const BANG = 0x21; // !
const QUESTION = 0x3f; // ?
const DQUOTE = 0x22;
const SQUOTE = 0x27;

export function prescan(text: string, file: string, maxDepth: number): void {
  const n = text.length;
  let depth = 0;
  let i = 0;
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) return;
    const next = text.charCodeAt(lt + 1);

    if (next === BANG) {
      if (text.startsWith('<!--', lt)) {
        i = skipPast(text, '-->', lt + 4);
      } else if (text.startsWith('<![CDATA[', lt)) {
        i = skipPast(text, ']]>', lt + 9);
      } else {
        if (text.slice(lt + 2, lt + 9).toUpperCase() === 'DOCTYPE') {
          const { line, column } = position(text, lt);
          throw new AfterlifeError('UNSAFE_XML', { file, line, column });
        }
        i = skipPast(text, '>', lt + 2);
      }
      continue;
    }
    if (next === QUESTION) {
      i = skipPast(text, '?>', lt + 2);
      continue;
    }
    if (next === SLASH) {
      depth = Math.max(0, depth - 1);
      i = skipPast(text, '>', lt + 2);
      continue;
    }

    // Start tag: find its end outside quoted attribute values.
    let j = lt + 1;
    let quote = 0;
    let last = 0;
    for (; j < n; j++) {
      const c = text.charCodeAt(j);
      if (quote) {
        if (c === quote) quote = 0;
      } else if (c === DQUOTE || c === SQUOTE) {
        quote = c;
      } else if (c === GT) {
        break;
      } else if (c === LT) {
        break; // malformed; the parser will report it
      } else if (c > 0x20) {
        last = c;
      }
    }
    const selfClosing = text.charCodeAt(j) === GT && last === SLASH;
    if (!selfClosing) {
      depth++;
      if (depth > maxDepth) {
        const { line, column } = position(text, lt);
        throw new AfterlifeError('LIMIT_EXCEEDED', {
          limit: 'xmlDepth',
          max: maxDepth,
          observed: depth,
          file,
          line,
          column,
        });
      }
    }
    i = text.charCodeAt(j) === GT ? j + 1 : j;
  }
}

function skipPast(text: string, end: string, from: number): number {
  const at = text.indexOf(end, from);
  return at < 0 ? text.length : at + end.length;
}

/** 1-based line and column of `index`; `\r\n`, `\r` and `\n` each end a line (XML 1.0 §2.11). */
export function position(text: string, index: number): { line: number; column: number } {
  let line = 1;
  let start = 0;
  for (let k = 0; k < index; k++) {
    const c = text.charCodeAt(k);
    if (c === 0x0a || (c === 0x0d && text.charCodeAt(k + 1) !== 0x0a)) {
      line++;
      start = k + 1;
    }
  }
  return { line, column: index - start + 1 };
}
