// The manifest walker (design §8.2): XmlElement tree → ModelNode tree + unknown entries, driven by
// a vocabulary table. A node is modelled exactly when it lands in the ModelNode tree (§8.4);
// everything else is one unknown entry (R13.1–R13.3), in document order (R13.7). `documented`
// says whether MS-IPFF2 names the node at that position (R13.8).

import { AfterlifeError } from '../errors';
import type { Located, UnknownEntry } from '../unknown';
import type { XmlAttribute, XmlElement, XmlText } from '../xml/node';
import { qualified } from '../xml/path';
import { MS_IPFF2, XD_YES_NO } from './ms-ipff2';
import { childKey, type AttrSpec, type ElementSpec, type Vocabulary } from './vocabulary';

export interface ModelNode extends Located {
  /** The position key in the vocabulary. */
  readonly key: string;
  /** Every modelled attribute present, as written (R7.5). */
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly ModelNode[];
  /** `text` content: the direct text, verbatim. */
  readonly text?: string;
  /** `rawXml` content: the inner XML, verbatim. */
  readonly raw?: string;
  /** The element this node was read from (for unknown entries made after the walk). */
  readonly element: XmlElement;
}

/** Which nodes the format's own specification defines at a position (R13.8, R15.4). */
export interface Documentation {
  attr(key: string, name: string): boolean;
  child(parentKey: string, child: XmlElement): boolean;
}

export interface WalkResult {
  readonly root: ModelNode;
  readonly unknowns: readonly UnknownEntry[];
}

const ROOT = 'xsf:xDocumentClass';

/** MS-IPFF2 5.1–5.3, from ms-ipff2.ts. */
export const MS_IPFF2_DOCUMENTATION: Documentation = {
  attr: (key, name) => documentedAttr(key, name),
  child: (parentKey, child) => documentedChild(parentKey, child),
};

export function walkManifest(root: XmlElement, file: string, vocabulary: Vocabulary): WalkResult {
  return walkTree(root, file, {
    vocabulary,
    rootKey: ROOT,
    documentation: MS_IPFF2_DOCUMENTATION,
    notRoot: 'not an InfoPath manifest: the root is not xsf:xDocumentClass',
  });
}

export interface WalkOptions {
  readonly vocabulary: Vocabulary;
  /** The qualified name the root must have; it is also the root's key. */
  readonly rootKey: string;
  readonly documentation: Documentation;
  /** The INVALID_XML reason when the root is something else. */
  readonly notRoot: string;
}

/** The generic walker (design §8.2), shared by the manifest and the schemas (§9.1). */
export function walkTree(root: XmlElement, file: string, options: WalkOptions): WalkResult {
  if (qualified(root.namespaceURI, root.localName) !== options.rootKey) {
    throw new AfterlifeError('INVALID_XML', {
      file,
      line: root.line,
      column: root.column,
      reason: options.notRoot,
    });
  }
  const unknowns: UnknownEntry[] = [];
  return { root: walk(root, options.rootKey, file, options, unknowns), unknowns };
}

function walk(
  el: XmlElement,
  key: string,
  file: string,
  options: WalkOptions,
  unknowns: UnknownEntry[],
): ModelNode {
  const { vocabulary, documentation } = options;
  const spec: ElementSpec | undefined = vocabulary[key];
  if (!spec) {
    throw new AfterlifeError('INTERNAL', { path: el.path, reason: `no vocabulary entry ${key}` });
  }

  const attrs: Record<string, string> = {};
  for (const a of el.attributes) {
    const name = attrKey(a);
    const attrSpec = Object.hasOwn(spec.attrs, name) ? spec.attrs[name] : undefined;
    if (attrSpec === undefined) {
      unknowns.push(unknownAttribute(a, file, 'notModelled', documentation.attr(key, name)));
      continue;
    }
    attrs[name] = a.value;
    if (!allowed(attrSpec, a.value)) {
      unknowns.push(unknownAttribute(a, file, 'unexpectedValue', documentation.attr(key, name)));
    }
  }

  const base = { file, path: el.path, line: el.line, column: el.column, key, attrs, element: el };
  if (spec.content === 'rawXml') return { ...base, children: [], raw: el.innerXml() };

  const children: ModelNode[] = [];
  for (const child of el.children) {
    if (child.kind === 'text') {
      if (spec.content === 'elements') unknowns.push(unknownText(child, file));
      continue;
    }
    const qname = qualified(child.namespaceURI, child.localName);
    const target =
      spec.content === 'elements' && Object.hasOwn(spec.children, qname)
        ? spec.children[qname]
        : undefined;
    if (target === undefined) {
      unknowns.push(unknownElement(child, file, 'notModelled', documentation.child(key, child)));
      continue;
    }
    children.push(walk(child, childKey(target), file, options, unknowns));
  }

  if (spec.content === 'text') return { ...base, children, text: el.textContent() };
  return { ...base, children };
}

function attrKey(a: XmlAttribute): string {
  return a.namespaceURI === null ? a.localName : `{${a.namespaceURI}}${a.localName}`;
}

function allowed(spec: AttrSpec, value: string): boolean {
  if (spec === 'string') return true;
  if (spec === 'yesNo') return XD_YES_NO.includes(value);
  return 'enum' in spec ? spec.enum.includes(value) : true;
}

/** MS-IPFF2 declares this attribute, by name, on this position. */
function documentedAttr(key: string, name: string): boolean {
  const pos = MS_IPFF2[key];
  return pos !== undefined && Object.hasOwn(pos.attrs, name);
}

/** MS-IPFF2 declares this element, by name, as a child of this position (local or global). */
function documentedChild(parentKey: string, child: XmlElement): boolean {
  const pos = MS_IPFF2[parentKey];
  if (!pos) return false;
  const qname = qualified(child.namespaceURI, child.localName);
  const parentPrefix = parentKey.slice(0, parentKey.indexOf(':'));
  const local = `${parentKey}/${child.localName}`;
  return (
    pos.children.includes(qname) ||
    (qname === `${parentPrefix}:${child.localName}` && pos.children.includes(local))
  );
}

export function unknownElement(
  el: XmlElement,
  file: string,
  reason: UnknownEntry['reason'],
  documented: boolean,
): UnknownEntry {
  return {
    kind: 'element',
    reason,
    file,
    path: el.path,
    line: el.line,
    column: el.column,
    namespace: el.namespaceURI,
    name: el.localName,
    raw: el.outerXml(),
    documented,
  };
}

export function unknownAttribute(
  a: XmlAttribute,
  file: string,
  reason: UnknownEntry['reason'],
  documented: boolean,
): UnknownEntry {
  return {
    kind: 'attribute',
    reason,
    file,
    path: a.path,
    line: a.line,
    column: a.column,
    namespace: a.namespaceURI,
    name: a.localName,
    raw: `${a.name}="${escapeAttr(a.value)}"`,
    documented,
  };
}

function unknownText(t: XmlText, file: string): UnknownEntry {
  return {
    kind: 'text',
    reason: 'notModelled',
    file,
    path: t.path,
    line: t.line,
    column: t.column,
    namespace: null,
    name: '#text',
    raw: t.text,
    documented: false,
  };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
