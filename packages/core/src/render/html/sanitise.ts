// The result-tree sanitiser (spec 03 design §8.1 steps 1, 5 and 8; §8.2). It walks the engine's
// result tree once and builds an HTML tree (`serialise.ts`) holding only allowed elements and
// attributes. It needs no DOM: the result tree is read through the few xmldom members below.
//
// Step 8 (inert controls) is applied in the same attribute pass: the marks of step 6 add only
// `data-afl-*` attributes, so doing it here gives the same tree.

import { filterDeclarations, withoutControls, type Removed } from './css';
import type { HElement, HNode } from './serialise';

/** The xmldom members read here. */
export interface ResultNode {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly localName?: string | null;
  readonly namespaceURI?: string | null;
  readonly data?: string;
  readonly value?: string;
  /** Set by xsltjs on text written with `disable-output-escaping="yes"`. */
  readonly xsltRaw?: boolean;
  readonly childNodes: { readonly length: number; item(i: number): ResultNode | null };
  readonly attributes?: { readonly length: number; item(i: number): ResultNode | null };
}

/** CONTENT_REMOVED kinds, in issue order. */
export const REMOVED_KINDS = ['element', 'attribute', 'url', 'css'] as const;
export type RemovedKind = (typeof REMOVED_KINDS)[number];

export interface Sanitised {
  /** `<div class="afl-root" data-afl-scope="…" inert>` holding the view. */
  readonly root: HElement;
  /** The text of every `style` element, in document order (§8.1 step 1). */
  readonly styles: readonly string[];
  /** What was removed, by kind: element names, attribute names, CSS names. */
  readonly removed: ReadonlyMap<RemovedKind, Removed>;
  /** Text nodes written with `disable-output-escaping` (D6), escaped like any text. */
  readonly rawTextNodes: number;
}

const XHTML = 'http://www.w3.org/1999/xhtml';

/** Dropped with their content. */
const DROP = new Set([
  ...['script', 'style', 'iframe', 'frame', 'frameset', 'embed', 'applet', 'base', 'link'],
  ...['meta', 'title', 'head', 'noscript', 'noembed', 'noframes', 'xmp', 'plaintext'],
  ...['template', 'svg', 'math', 'audio', 'video', 'source', 'track', 'canvas', 'param'],
]);

/** Kept, in no namespace or the XHTML namespace. Everything else is unwrapped. */
const KEEP = new Set([
  ...['a', 'abbr', 'address', 'b', 'big', 'blockquote', 'br', 'button', 'caption', 'center'],
  ...['cite', 'code', 'col', 'colgroup', 'dd', 'del', 'dfn', 'div', 'dl', 'dt', 'em'],
  ...['fieldset', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'ins'],
  ...['kbd', 'label', 'legend', 'li', 'nobr', 'ol', 'optgroup', 'option', 'p', 'pre', 'q', 's'],
  ...['samp', 'select', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'table', 'tbody'],
  ...['td', 'textarea', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul', 'var', 'wbr'],
]);

/** Unwrapped without being counted: the page structure step 1 takes apart. */
const STRUCTURE = new Set(['html', 'body']);

const ATTR_NAME = /^[a-z_:][a-z0-9_:.-]*$/;
const DENIED_ATTRS = new Set(['srcdoc', 'action', 'formaction', 'xlink:href', 'ping']);
/** Step 8, dropped silently: InfoPath's editing attributes and anything that takes focus. */
const INERT_ATTRS = new Set(['contenteditable', 'tabindex', 'accesskey', 'autofocus', 'hidefocus']);
/** Step 8: prefixed so that no page global or label is shadowed by name. */
const PREFIXED_ATTRS = new Set(['id', 'name', 'for']);
const LOADING_ATTRS = new Set([
  'src',
  'srcset',
  'poster',
  'background',
  'lowsrc',
  'dynsrc',
  'data',
]);
const HREF_SCHEMES = new Set(['http', 'https', 'mailto']);
const RASTER_DATA = /^data:image\/(?:png|gif|jpeg|bmp);base64,[a-z0-9+/=]*$/i;

/** As the URL parser reads a scheme: ASCII whitespace and control characters removed. */
const urlForm = withoutControls;

export function sanitiseResult(fragment: ResultNode, scope: string): Sanitised {
  const removed = new Map<RemovedKind, Removed>(REMOVED_KINDS.map((k) => [k, []]));
  const styles: string[] = [];
  let rawTextNodes = 0;
  const remove = (kind: RemovedKind, what: string) => removed.get(kind)!.push(what);

  collectStyles(fragment, styles);
  const html = elementChildren(fragment).find((n) => nameOf(n) === 'html');
  const body = html && elementChildren(html).find((n) => nameOf(n) === 'body');
  const container = body ?? html ?? fragment;

  const walk = (node: ResultNode, out: HNode[]): void => {
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes.item(i)!;
      if (child.nodeType === 3 || child.nodeType === 4) {
        if (child.xsltRaw) rawTextNodes++;
        if (child.data) out.push({ kind: 'text', text: child.data });
        continue;
      }
      if (child.nodeType !== 1) continue; // comments and processing instructions
      const name = nameOf(child);
      if (name === 'style' || (name === 'head' && node === html)) continue;
      if (DROP.has(name)) {
        remove('element', name);
        continue;
      }
      const ns = child.namespaceURI ?? null;
      if (!KEEP.has(name) || (ns !== null && ns !== XHTML)) {
        if (!STRUCTURE.has(name)) remove('element', name);
        walk(child, out);
        continue;
      }
      const el: HElement = {
        kind: 'element',
        name,
        attrs: attributes(child, name, remove),
        children: [],
        origin: child,
      };
      walk(child, el.children);
      out.push(el);
    }
  };

  const rootAttrs: [string, string][] = [];
  const bodyAttr = (n: string) => (body ? attr(body, n) : undefined);
  rootAttrs.push(['class', ['afl-root', bodyAttr('class')?.trim()].filter(Boolean).join(' ')]);
  rootAttrs.push(['data-afl-scope', scope]);
  for (const n of ['dir', 'lang']) {
    const v = bodyAttr(n);
    if (v !== undefined) rootAttrs.push([n, v]);
  }
  const bodyStyle = bodyAttr('style');
  if (bodyStyle !== undefined) {
    const css: Removed = [];
    const kept = filterDeclarations(bodyStyle, css);
    for (const r of css) remove('css', r);
    if (kept !== '') rootAttrs.push(['style', kept]);
  }
  rootAttrs.push(['inert', '']);

  const root: HElement = { kind: 'element', name: 'div', attrs: rootAttrs, children: [] };
  walk(container, root.children);
  return { root, styles, removed, rawTextNodes };
}

function attributes(
  el: ResultNode,
  element: string,
  remove: (kind: RemovedKind, what: string) => void,
): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<string>();
  const list = el.attributes;
  for (let i = 0; list && i < list.length; i++) {
    const a = list.item(i)!;
    const name = a.nodeName.toLowerCase();
    const value = a.value ?? '';
    if (name === 'xmlns' || name.startsWith('xmlns:') || INERT_ATTRS.has(name)) continue;
    if (
      !ATTR_NAME.test(name) ||
      name.startsWith('on') ||
      name.startsWith('data-afl-') ||
      DENIED_ATTRS.has(name)
    ) {
      remove('attribute', name);
      continue;
    }
    if (seen.has(name)) continue; // the HTML parser keeps the first
    seen.add(name);
    if (name === 'href') {
      const scheme = /^([a-z][a-z0-9+.-]*):/.exec(urlForm(value).toLowerCase())?.[1];
      if (element === 'a' && scheme !== undefined && HREF_SCHEMES.has(scheme)) {
        out.push([name, value]);
      } else {
        remove('url', name);
      }
    } else if (LOADING_ATTRS.has(name)) {
      const url = urlForm(value);
      if (RASTER_DATA.test(url)) out.push([name, url]);
      else remove('url', name);
    } else if (name === 'style') {
      const css: Removed = [];
      const kept = filterDeclarations(value, css);
      for (const r of css) remove('css', r);
      if (kept !== '') out.push([name, kept]);
    } else if (PREFIXED_ATTRS.has(name)) {
      out.push([name, `afl-${value}`]);
    } else {
      out.push([name, value]);
    }
  }
  return out;
}

function collectStyles(node: ResultNode, out: string[]): void {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes.item(i)!;
    if (child.nodeType !== 1) continue;
    const name = nameOf(child);
    if (name === 'style') out.push(textContent(child));
    else if (!DROP.has(name) || name === 'head') collectStyles(child, out);
  }
}

function textContent(node: ResultNode): string {
  let s = '';
  for (let i = 0; i < node.childNodes.length; i++) {
    const c = node.childNodes.item(i)!;
    if (c.nodeType === 3 || c.nodeType === 4) s += c.data ?? '';
    else if (c.nodeType === 1) s += textContent(c);
  }
  return s;
}

function elementChildren(node: ResultNode): ResultNode[] {
  const out: ResultNode[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const c = node.childNodes.item(i)!;
    if (c.nodeType === 1) out.push(c);
  }
  return out;
}

function attr(el: ResultNode, name: string): string | undefined {
  const list = el.attributes;
  for (let i = 0; list && i < list.length; i++) {
    const a = list.item(i)!;
    if (a.nodeName.toLowerCase() === name) return a.value ?? '';
  }
  return undefined;
}

const nameOf = (n: ResultNode) => (n.localName ?? n.nodeName).toLowerCase();
