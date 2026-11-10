// Parser-safe nesting (spec 03 design §8.2, `Changed at task 12:`). The serialiser writes the
// tree it is given with balanced tags, but the HTML parser does not always build that tree back:
// some start tags close open elements implicitly. An end tag written for an element the parser
// already closed then closes an ancestor instead, and with the render root as the nearest `div`
// the rest of the view lands outside the root: outside `inert`, the scoped styles and
// `contain: layout paint` (P5 found `<select><div><select></select></div></select>`).
//
// This pass rewrites the tree so that no start tag closes anything implicitly:
// - `select` holds only `option` and `optgroup`, `optgroup` only `option`, and an `option` in a
//   `select` only text; anything else is unwrapped (its children kept, a void element gone);
// - `a`, `button` and `nobr` inside an element of the same name are unwrapped;
// - `li` stays only in `ul` or `ol`, `dd` and `dt` only in `dl`;
// - table parts stay only in their places: `caption`, `colgroup`, `thead`, `tbody` and `tfoot`
//   in `table`; `tr` in `table` or a section; `td` and `th` in `tr`, a section or `table`;
//   `col` in `colgroup` or `table`. The parser adds the `tbody` or `tr` a cell lacks, which
//   closes nothing of ours. A misplaced part is unwrapped;
// - anything else inside `table`, a section, `tr` or `colgroup` (another element, or text that
//   is not whitespace) is moved before the table, as the parser's foster parenting would.
// Each unwrapped element is reported (`CONTENT_REMOVED {kind: element}`); a moved one is not.

import type { HElement, HNode } from './serialise';

/** Parents whose content the parser reads in a table insertion mode. */
const TABLE_MODE = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup']);
/** Where each table part may stand. */
const PART_PARENTS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['caption', new Set(['table'])],
  ['colgroup', new Set(['table'])],
  ['thead', new Set(['table'])],
  ['tbody', new Set(['table'])],
  ['tfoot', new Set(['table'])],
  ['tr', new Set(['table', 'thead', 'tbody', 'tfoot'])],
  ['td', new Set(['tr', 'table', 'thead', 'tbody', 'tfoot'])],
  ['th', new Set(['tr', 'table', 'thead', 'tbody', 'tfoot'])],
  ['col', new Set(['colgroup', 'table'])],
  ['li', new Set(['ul', 'ol'])],
  ['dd', new Set(['dl'])],
  ['dt', new Set(['dl'])],
]);
/** What each table-mode parent may hold, besides whitespace. */
const TABLE_CHILDREN: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['table', new Set(['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'col'])],
  ['thead', new Set(['tr', 'td', 'th'])],
  ['tbody', new Set(['tr', 'td', 'th'])],
  ['tfoot', new Set(['tr', 'td', 'th'])],
  ['tr', new Set(['td', 'th'])],
  ['colgroup', new Set(['col'])],
]);
/** Elements the parser closes when the same name opens inside them. */
const NOT_NESTED = new Set(['a', 'button', 'nobr', 'select']);
const SELECT_CHILDREN: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['select', new Set(['option', 'optgroup'])],
  ['optgroup', new Set(['option'])],
  ['option', new Set<string>()],
]);
const TABLE_PARTS = new Set(
  [...PART_PARENTS.keys()].filter((n) => !['li', 'dd', 'dt'].includes(n)),
);
const WHITESPACE = /^[\t\n\f\r ]*$/;

interface Context {
  /** Names of the open elements, the parent last. */
  readonly open: readonly string[];
  readonly inSelect: boolean;
}

/** Rewrites `root`'s content in place; `unwrapped` is called once per unwrapped element. */
export function parserSafe(root: HElement, unwrapped: (name: string) => void): void {
  const ctx: Context = { open: [root.name], inSelect: false };
  root.children = list(root.children, root.name, ctx, unwrapped);
}

/** `nodes` as the content of a `parent` element, with the result in order. */
function list(
  nodes: readonly HNode[],
  parent: string,
  ctx: Context,
  unwrapped: (name: string) => void,
): HNode[] {
  const out: HNode[] = [];
  const add = (node: HNode) => {
    if (node.kind === 'text') {
      out.push(node);
      return;
    }
    if (!allowed(node.name, parent, ctx)) {
      unwrapped(node.name);
      for (const c of list(node.children, parent, ctx, unwrapped)) out.push(c);
      return;
    }
    const inner: Context = {
      open: [...ctx.open, node.name],
      inSelect: ctx.inSelect || node.name === 'select',
    };
    const fostered: HNode[] = [];
    node.children = content(node, inner, fostered, unwrapped);
    // Foster parenting: what a table could not hold stands before it, in the table's context.
    if (node.name === 'table') for (const f of list(fostered, parent, ctx, unwrapped)) out.push(f);
    else if (fostered.length > 0) throw new Error('fostered content outside a table');
    out.push(node);
  };
  for (const n of nodes) add(n);
  return out;
}

/**
 * The content of `el`. In a table-mode element, children it may not hold go to `fostered`
 * (handled by the table's caller); table parts pass up what their own content fostered.
 */
function content(
  el: HElement,
  ctx: Context,
  fostered: HNode[],
  unwrapped: (name: string) => void,
): HNode[] {
  if (!TABLE_MODE.has(el.name)) return list(el.children, el.name, ctx, unwrapped);
  const accepted = TABLE_CHILDREN.get(el.name)!;
  const out: HNode[] = [];
  const add = (node: HNode) => {
    if (node.kind === 'text') {
      if (WHITESPACE.test(node.text)) out.push(node);
      else fostered.push(node);
      return;
    }
    if (!accepted.has(node.name)) {
      // A misplaced table part is unwrapped where it stands; anything else is fostered.
      if (TABLE_PARTS.has(node.name)) {
        unwrapped(node.name);
        for (const c of node.children) add(c);
      } else {
        fostered.push(node);
      }
      return;
    }
    const inner: Context = { open: [...ctx.open, node.name], inSelect: ctx.inSelect };
    node.children = content(node, inner, fostered, unwrapped);
    out.push(node);
  };
  for (const n of el.children) add(n);
  return out;
}

/** Whether `name` may stand in `parent` without the parser closing anything. */
function allowed(name: string, parent: string, ctx: Context): boolean {
  const select = ctx.inSelect ? SELECT_CHILDREN.get(parent) : undefined;
  if (select !== undefined) return select.has(name);
  if (NOT_NESTED.has(name) && ctx.open.includes(name)) return false;
  const places = PART_PARENTS.get(name);
  return places === undefined || places.has(parent);
}
