// The small read-only XML tree that xsf/ and xsd/ use (design §7.2). Nothing outside src/xml/
// sees a parser type: this module describes the DOM it reads structurally, and parse.ts (the only
// importer of @xmldom/xmldom) hands it the document.

import { attributeStep, elementStep, NS, textStep } from './path';

export interface XmlAttribute {
  readonly kind: 'attribute';
  readonly localName: string;
  readonly namespaceURI: string | null;
  /** The name as written, prefix included. */
  readonly name: string;
  readonly value: string;
  /** Position of the value's opening quote, as @xmldom/xmldom 0.9.12 reports it. */
  readonly line: number;
  readonly column: number;
  readonly path: string;
}

export interface XmlText {
  readonly kind: 'text';
  /** Adjacent text and CDATA joined, verbatim (one XPath text node). */
  readonly text: string;
  readonly line: number;
  readonly column: number;
  readonly path: string;
}

export interface XmlElement {
  readonly kind: 'element';
  readonly localName: string;
  readonly namespaceURI: string | null;
  /** The name as written, prefix included. */
  readonly name: string;
  /** In document order, without namespace declarations. */
  readonly attributes: readonly XmlAttribute[];
  /** Elements and text that is not only whitespace, in document order. */
  readonly children: readonly (XmlElement | XmlText)[];
  readonly line: number;
  readonly column: number;
  readonly path: string;
  /** The element serialised, with the namespaces in scope re-declared. */
  outerXml(): string;
  /** Every child node serialised and joined: elements, text, CDATA, comments and PIs, verbatim. */
  innerXml(): string;
  /** The direct text and CDATA children joined, whitespace-only runs included, verbatim. */
  textContent(): string;
  /**
   * The namespace bound to `prefix` in scope here; `null` (or `''`) asks for the default
   * namespace. `xml` is always bound. Unbound gives `null`. For QName values (`ref`, `type`).
   */
  lookupNamespace(prefix: string | null): string | null;
}

/** The parts of a DOM node this module reads. */
export interface DomNode {
  readonly nodeType: number;
  readonly localName?: string | null;
  readonly namespaceURI?: string | null;
  readonly nodeName: string;
  readonly nodeValue?: string | null;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly childNodes: ArrayLike<DomNode>;
  readonly attributes?: ArrayLike<DomNode & { readonly value: string }>;
  lookupNamespaceURI?(prefix: string | null): string | null;
}

const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;
const XMLNS = 'http://www.w3.org/2000/xmlns/';

export function buildTree(root: DomNode, serialize: (node: DomNode) => string): XmlElement {
  return element(root, `/${elementStep(ns(root), local(root), 1)}`, serialize);
}

function element(node: DomNode, path: string, serialize: (n: DomNode) => string): XmlElement {
  const attributes: XmlAttribute[] = [];
  for (const a of Array.from(node.attributes ?? [])) {
    if (a.namespaceURI === XMLNS || a.nodeName === 'xmlns' || a.nodeName.startsWith('xmlns:')) {
      continue;
    }
    attributes.push({
      kind: 'attribute',
      localName: local(a),
      namespaceURI: ns(a),
      name: a.nodeName,
      value: a.value,
      line: a.lineNumber ?? 0,
      column: a.columnNumber ?? 0,
      path: `${path}/${attributeStep(ns(a), local(a))}`,
    });
  }

  const children: (XmlElement | XmlText)[] = [];
  const seen = new Map<string, number>();
  let texts = 0;
  let run: { text: string; line: number; column: number } | undefined;
  const flush = () => {
    if (!run) return;
    texts++;
    if (!isWhitespace(run.text)) {
      children.push({ kind: 'text', ...run, path: `${path}/${textStep(texts)}` });
    }
    run = undefined;
  };

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === TEXT || child.nodeType === CDATA) {
      const text = child.nodeValue ?? '';
      if (run) run.text += text;
      else run = { text, line: child.lineNumber ?? 0, column: child.columnNumber ?? 0 };
      continue;
    }
    flush();
    if (child.nodeType !== ELEMENT) continue; // comments and processing instructions
    const key = `${ns(child) ?? ''}\u0000${local(child)}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    children.push(element(child, `${path}/${elementStep(ns(child), local(child), n)}`, serialize));
  }
  flush();

  return {
    kind: 'element',
    localName: local(node),
    namespaceURI: ns(node),
    name: node.nodeName,
    attributes,
    children,
    line: node.lineNumber ?? 0,
    column: node.columnNumber ?? 0,
    path,
    outerXml: () => serialize(node),
    innerXml: () =>
      Array.from(node.childNodes)
        .map((c) => serialize(c))
        .join(''),
    textContent: () =>
      Array.from(node.childNodes)
        .filter((c) => c.nodeType === TEXT || c.nodeType === CDATA)
        .map((c) => c.nodeValue ?? '')
        .join(''),
    lookupNamespace: (prefix) => {
      if (prefix === 'xml') return NS.xml;
      // xmldom 0.9.12 answers the default namespace for '' (not for null).
      return node.lookupNamespaceURI?.(prefix ?? '') || null;
    },
  };
}

function ns(node: DomNode): string | null {
  return node.namespaceURI || null;
}

function local(node: DomNode): string {
  return node.localName ?? node.nodeName;
}

/** XML whitespace: space, tab, CR, LF (XML 1.0 production S). */
function isWhitespace(s: string): boolean {
  return /^[ \t\r\n]*$/.test(s);
}
