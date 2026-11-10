// Element tests and cell text for the view scan and the label step (spec 02 design §6.2). Text of
// a node: its text children and `xsl:text` contents in document order, without bound controls
// and other `xsl:*` elements, whitespace collapsed. A moded template is read as part of the
// `apply-templates` on the control's chain that called it.

import type { XmlAttribute, XmlElement } from '../../xml/node';

export const XSL = 'http://www.w3.org/1999/XSL/Transform';
export const XD = 'http://schemas.microsoft.com/office/infopath/2003';
const XHTML = 'http://www.w3.org/1999/xhtml';

export const isXsl = (e: XmlElement, local?: string): boolean =>
  e.namespaceURI === XSL && (local === undefined || e.localName === local);
/** An HTML element (no namespace, or XHTML) with this lower-case name. */
export const isHtml = (e: XmlElement, local: string): boolean =>
  (e.namespaceURI === null || e.namespaceURI === XHTML) && e.localName.toLowerCase() === local;
export const attrOf = (e: XmlElement, ns: string | null, local: string): XmlAttribute | undefined =>
  e.attributes.find((a) => a.namespaceURI === ns && a.localName === local);
export const bindingOf = (e: XmlElement): XmlAttribute | undefined => attrOf(e, XD, 'binding');
const isCell = (e: XmlElement) => isHtml(e, 'td') || isHtml(e, 'th');

/** Whitespace collapsed and trimmed. */
export const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Where a piece of text sits in the XSL. */
export interface TextAt {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

type Item =
  | { readonly kind: 'text'; readonly text: string; readonly at?: TextAt }
  | { readonly kind: 'control'; readonly el: XmlElement }
  /** Something that may produce controls (`apply-templates`, `for-each` off the chain). */
  | { readonly kind: 'barrier' };

const TRANSPARENT = new Set(['if', 'choose', 'when', 'otherwise']);
const BLOCK = new Set([
  'div',
  'p',
  'br',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ul',
  'ol',
]);

/** `n`'s content in document order; `k` is `n`'s index in `chain`, or -1 when off the chain. */
function items(n: XmlElement, chain: readonly XmlElement[], k: number, out: Item[] = []): Item[] {
  for (const c of n.children) {
    if (c.kind === 'text') {
      out.push({ kind: 'text', text: c.text, at: c });
      continue;
    }
    const ck = k >= 0 && chain[k + 1] === c ? k + 1 : -1;
    if (bindingOf(c) !== undefined) {
      out.push({ kind: 'control', el: c });
    } else if (isXsl(c)) {
      if (TRANSPARENT.has(c.localName)) items(c, chain, ck, out);
      else if (c.localName === 'text') out.push({ kind: 'text', text: c.textContent(), at: c });
      else if (c.localName === 'apply-templates' && ck >= 0 && chain[ck + 1] !== undefined)
        items(chain[ck + 1]!, chain, ck + 1, out);
      else if (ck >= 0) items(c, chain, ck, out);
      else if (c.localName === 'apply-templates' || c.localName === 'for-each')
        out.push({ kind: 'barrier' });
    } else {
      const block = BLOCK.has(c.localName.toLowerCase());
      if (block) out.push({ kind: 'text', text: ' ' });
      items(c, chain, ck, out);
      if (block) out.push({ kind: 'text', text: ' ' });
    }
  }
  return out;
}

export interface Text {
  readonly text: string;
  /** The first non-blank piece used. */
  readonly at?: TextAt;
}

function join(list: readonly Item[]): Text {
  let text = '';
  let at: TextAt | undefined;
  for (const i of list) {
    if (i.kind !== 'text') continue;
    text += i.text;
    if (at === undefined && i.at !== undefined && i.text.trim() !== '') at = i.at;
  }
  return { text: collapse(text), ...(at === undefined ? {} : { at }) };
}

/** Index in `chain` of the control's own cell (nearest `td`/`th`), or -1. */
export function cellIndex(chain: readonly XmlElement[]): number {
  for (let i = chain.length - 2; i >= 0; i--) if (isCell(chain[i]!)) return i;
  return -1;
}

/**
 * Text in the control's own cell before it (back to the previous bound control) and after it
 * (up to the next one), and the `xd:xctname` of that previous control. Without a cell, the
 * control's parent bounds the search.
 */
export function textAround(
  e: XmlElement,
  chain: readonly XmlElement[],
): { before: Text; after: Text; previous?: string } {
  const ci = cellIndex(chain);
  const from = ci >= 0 ? ci : chain.length - 2;
  if (from < 0) return { before: { text: '' }, after: { text: '' } };
  const list = items(chain[from]!, chain, from);
  const at = list.findIndex((i) => i.kind === 'control' && i.el === e);
  if (at < 0) return { before: { text: '' }, after: { text: '' } };
  let start = at;
  while (start > 0 && list[start - 1]!.kind === 'text') start--;
  let end = at + 1;
  while (end < list.length && list[end]!.kind === 'text') end++;
  const prev = list[start - 1];
  const previous = prev?.kind === 'control' ? attrOf(prev.el, XD, 'xctname')?.value : undefined;
  return {
    before: join(list.slice(start, at)),
    after: join(list.slice(at + 1, end)),
    ...(previous === undefined ? {} : { previous }),
  };
}

/** Text of a cell, or undefined when it holds a bound control (or may produce one). */
export function cellText(cell: XmlElement): Text | undefined {
  const list = items(cell, [], -1);
  return list.some((i) => i.kind !== 'text') ? undefined : join(list);
}

const cellsOf = (row: XmlElement): XmlElement[] =>
  row.children.filter((c): c is XmlElement => c.kind === 'element' && isCell(c));

function rowAndColumn(chain: readonly XmlElement[]) {
  const ci = cellIndex(chain);
  if (ci < 1 || !isHtml(chain[ci - 1]!, 'tr')) return undefined;
  const row = chain[ci - 1]!;
  return { row, column: cellsOf(row).indexOf(chain[ci]!) };
}

/** The cell to the left of the control's own cell in the same row. */
export function leftCell(chain: readonly XmlElement[]): XmlElement | undefined {
  const rc = rowAndColumn(chain);
  return rc && rc.column > 0 ? cellsOf(rc.row)[rc.column - 1] : undefined;
}

/**
 * For a control in a repeating row: the header cell at its column. From the repeat point go up
 * to the nearest `table`; the header row is the last `tr` of that table before the repeat point
 * that does not contain it. `colspan` is ignored.
 */
export function headerCell(chain: readonly XmlElement[], repeatAt: number): XmlElement | undefined {
  if (repeatAt < 0) return undefined;
  const rc = rowAndColumn(chain);
  if (!rc || rc.column < 0) return undefined;
  let ti = repeatAt - 1;
  while (ti >= 0 && !isHtml(chain[ti]!, 'table')) ti--;
  if (ti < 0) return undefined;
  const point = chain[repeatAt]!;
  const above = new Set(chain.slice(ti + 1, repeatAt));
  let last: XmlElement | undefined;
  let stop = false;
  const walk = (n: XmlElement) => {
    for (const c of n.children) {
      if (stop) return;
      if (c.kind !== 'element') continue;
      if (c === point) {
        stop = true;
        return;
      }
      if (above.has(c)) walk(c);
      else if (isHtml(c, 'tr')) last = c;
      else if (!isHtml(c, 'table')) walk(c);
    }
  };
  walk(chain[ti]!);
  return last && cellsOf(last)[rc.column];
}
