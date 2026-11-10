// Dev only: generates src/xsf/ms-ipff2.ts from the XSDs published in MS-IPFF2 sections 5.1, 5.2
// and 5.3 (design D6; R13.4, R13.8). Run with `pnpm --filter @afterlife/core gen:ms-ipff2`.
//
// The output holds only element names, attribute names and enumeration values, keyed by element
// position: a global element is `xsf:rule`; a local element is `<parent key>/<local name>`, e.g.
// `xsf:submit/errorMessage`. No prose and no XSD text is copied.

import { writeFileSync } from 'node:fs';
import { DOMParser, type Element } from '@xmldom/xmldom';

const BASE = 'https://learn.microsoft.com/en-us/openspecs/sharepoint_protocols/ms-ipff2/';
const SECTIONS = [
  {
    section: '5.1',
    title: 'The InfoPath XSF XSD file',
    id: '733aec6d-77b6-42e2-81af-ac3db2768ed9',
  },
  {
    section: '5.2',
    title: 'The InfoPath XSF2 XSD file',
    id: '5026480d-57f0-43f5-b6a0-0b7bdf6cb11e',
  },
  {
    section: '5.3',
    title: 'The InfoPath XSF3 XSD file',
    id: '2ea13fc9-3633-42bc-88c0-0b88120ddc00',
  },
];
const OUT = new URL('../src/xsf/ms-ipff2.ts', import.meta.url);

const XSD = 'http://www.w3.org/2001/XMLSchema';
const PREFIX: Record<string, string> = {
  'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition': 'xsf',
  'http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions': 'xsf2',
  'http://schemas.microsoft.com/office/infopath/2009/solutionDefinition/extensions': 'xsf3',
};
const YES_NO = `{${Object.keys(PREFIX)[0]}}xdYesNo`;

type AttrSpec = 'string' | 'yesNo' | { enum: string[] };
interface Position {
  attrs: Map<string, AttrSpec>;
  children: Set<string>;
  /** Effective maxOccurs of each child position, summed over the particles it appears in. */
  maxOccurs: Map<string, number>;
  /** Children of an xsd:choice that can occur once in total (choice and members maxOccurs 1). */
  choices: string[][];
  /** Character content is allowed: a simple type, simple content, mixed content or xsd:anyType. */
  text: boolean;
  /** Element content allows any element: an `xsd:any` particle, or no type at all (`xsd:anyType`). */
  wildcard: boolean;
  /** `namespace` of an `xsd:anyAttribute` (`##any` when not written); `xsd:anyType` counts as `##any`. */
  anyAttribute?: string;
}

// ---- fetch and extract ------------------------------------------------------------------------

async function fetchXsd(id: string): Promise<string> {
  const res = await fetch(`${BASE}${id}`);
  if (!res.ok) throw new Error(`${BASE}${id}: HTTP ${res.status}`);
  const html = await res.text();
  const pre = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(html);
  if (!pre) throw new Error(`${id}: no <pre> block`);
  return unescapeHtml(pre[1]!.replace(/<[^>]+>/g, '')).trim();
}

function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|lt|gt|amp|quot|apos|nbsp);/gi, (_m, e: string) => {
    const k = e.toLowerCase();
    if (k[0] === '#')
      return String.fromCodePoint(parseInt(k.slice(k[1] === 'x' ? 2 : 1), k[1] === 'x' ? 16 : 10));
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }[k]!;
  });
}

// ---- schema index -----------------------------------------------------------------------------

interface Decl {
  el: Element;
  ns: string; // target namespace of the schema the declaration is in
}
const globals = {
  element: new Map<string, Decl>(),
  complexType: new Map<string, Decl>(),
  simpleType: new Map<string, Decl>(),
  group: new Map<string, Decl>(),
  attributeGroup: new Map<string, Decl>(),
  attribute: new Map<string, Decl>(),
};

function xsdChildren(el: Element, local?: string): Element[] {
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1) {
      const c = n as Element;
      if (c.namespaceURI === XSD && (local === undefined || c.localName === local)) out.push(c);
    }
  }
  return out;
}

function index(schema: Element): void {
  const ns = schema.getAttribute('targetNamespace') ?? '';
  for (const c of xsdChildren(schema)) {
    const kind = c.localName as keyof typeof globals;
    if (kind in globals && c.hasAttribute('name')) {
      const key = `{${ns}}${c.getAttribute('name')}`;
      if (globals[kind].has(key)) throw new Error(`duplicate global ${kind} ${key}`);
      globals[kind].set(key, { el: c, ns });
    }
  }
}

function resolve(el: Element, qname: string): string {
  const colon = qname.indexOf(':');
  const prefix = colon < 0 ? null : qname.slice(0, colon);
  const uri = el.lookupNamespaceURI(prefix) ?? '';
  if (prefix !== null && uri === '') throw new Error(`unbound prefix in ${qname}`);
  return `{${uri}}${qname.slice(colon + 1)}`;
}

function need<T>(map: Map<string, T>, key: string, what: string): T {
  const v = map.get(key);
  if (!v) throw new Error(`unresolved ${what} ${key}`);
  return v;
}

function qnameKey(ns: string, local: string): string {
  const p = PREFIX[ns];
  if (!p) throw new Error(`no prefix for namespace ${ns}`);
  return `${p}:${local}`;
}

// ---- attribute types --------------------------------------------------------------------------

function typeSpec(el: Element, typeName: string | null, seen = new Set<string>()): AttrSpec {
  if (typeName === null) return 'string';
  const key = resolve(el, typeName);
  if (key === YES_NO) return 'yesNo';
  if (key.startsWith(`{${XSD}}`)) return 'string';
  if (seen.has(key)) return 'string';
  seen.add(key);
  return simpleSpec(need(globals.simpleType, key, 'simpleType').el, seen);
}

function simpleSpec(st: Element, seen: Set<string>): AttrSpec {
  const restriction = xsdChildren(st, 'restriction')[0];
  if (!restriction) return 'string'; // list or union: not an explicit enumeration
  const values = xsdChildren(restriction, 'enumeration').map((e) => e.getAttribute('value') ?? '');
  if (values.length) return { enum: values };
  const inline = xsdChildren(restriction, 'simpleType')[0];
  if (inline) return simpleSpec(inline, seen);
  return typeSpec(restriction, restriction.getAttribute('base'), seen);
}

function attrSpec(a: Element): AttrSpec {
  const inline = xsdChildren(a, 'simpleType')[0];
  return inline ? simpleSpec(inline, new Set()) : typeSpec(a, a.getAttribute('type'));
}

// ---- positions --------------------------------------------------------------------------------

const positions = new Map<string, Position>();

function elementPosition(key: string, decl: Element, declNs: string, stack: string[]): void {
  if (positions.has(key)) return;
  const pos: Position = {
    attrs: new Map(),
    children: new Set(),
    maxOccurs: new Map(),
    choices: [],
    text: false,
    wildcard: false,
  };
  positions.set(key, pos);
  const inline = xsdChildren(decl, 'complexType')[0];
  if (inline) {
    pos.text = hasText(inline);
    complexType(key, inline, declNs, pos, stack);
    return;
  }
  const type = decl.getAttribute('type');
  if (type === null) {
    pos.text = true;
    if (xsdChildren(decl, 'simpleType').length) return; // inline simple type: text content
    // No type and no inline type: xsd:anyType, any content and any attribute.
    pos.wildcard = true;
    pos.anyAttribute = '##any';
    return;
  }
  const typeKey = resolve(decl, type);
  const ct = globals.complexType.get(typeKey);
  if (!ct) {
    pos.text = true; // simple or built-in type: text content, no attributes
    return;
  }
  if (stack.includes(typeKey)) throw new Error(`recursive type ${typeKey} at ${key}`);
  pos.text = hasText(ct.el);
  complexType(key, ct.el, ct.ns, pos, [...stack, typeKey]);
}

/** Mixed or simple content (a complex type's own declaration; derivation keeps it). */
function hasText(ct: Element): boolean {
  return ct.getAttribute('mixed') === 'true' || xsdChildren(ct, 'simpleContent').length > 0;
}

/** maxOccurs of a particle; `unbounded` is Infinity. */
function maxOf(particle: Element): number {
  const v = particle.getAttribute('maxOccurs');
  return v === null ? 1 : v === 'unbounded' ? Infinity : Number(v);
}

function complexType(
  key: string,
  ct: Element,
  ns: string,
  pos: Position,
  stack: string[],
  mult = 1,
): void {
  for (const c of xsdChildren(ct)) {
    switch (c.localName) {
      case 'complexContent':
      case 'simpleContent':
        for (const d of xsdChildren(c)) {
          if (d.localName !== 'extension' && d.localName !== 'restriction') continue;
          const base = resolve(d, d.getAttribute('base') ?? '');
          const baseCt = globals.complexType.get(base);
          if (baseCt && d.localName === 'extension')
            complexType(key, baseCt.el, baseCt.ns, pos, stack, mult);
          complexType(key, d, ns, pos, stack, mult);
        }
        break;
      case 'sequence':
      case 'choice':
      case 'all':
        particles(key, c, ns, pos, stack, mult * maxOf(c));
        break;
      case 'group': {
        const g = need(globals.group, resolve(c, c.getAttribute('ref') ?? ''), 'group');
        complexType(key, g.el, g.ns, pos, stack, mult * maxOf(c));
        break;
      }
      case 'attribute':
        attribute(c, ns, pos);
        break;
      case 'attributeGroup': {
        const g = need(
          globals.attributeGroup,
          resolve(c, c.getAttribute('ref') ?? ''),
          'attributeGroup',
        );
        complexType(key, g.el, g.ns, pos, stack);
        break;
      }
      case 'anyAttribute':
        pos.anyAttribute = c.getAttribute('namespace') ?? '##any';
        break;
      // annotation: no names to record
    }
  }
}

/** `mult`: the product of the maxOccurs of `model` and every enclosing particle. */
function particles(
  key: string,
  model: Element,
  ns: string,
  pos: Position,
  stack: string[],
  mult: number,
): void {
  const members: string[] = [];
  let onlyElements = true;
  for (const c of xsdChildren(model)) {
    if (c.localName === 'sequence' || c.localName === 'choice' || c.localName === 'all') {
      onlyElements = false;
      particles(key, c, ns, pos, stack, mult * maxOf(c));
    } else if (c.localName === 'group') {
      onlyElements = false;
      const g = need(globals.group, resolve(c, c.getAttribute('ref') ?? ''), 'group');
      complexType(key, g.el, g.ns, pos, stack, mult * maxOf(c));
    } else if (c.localName === 'element') {
      const ref = c.getAttribute('ref');
      let childKey: string;
      if (ref !== null) {
        const target = resolve(c, ref);
        need(globals.element, target, 'element');
        const [, uri, local] = /^\{(.*)\}(.*)$/.exec(target)!;
        childKey = qnameKey(uri!, local!);
        pos.children.add(childKey);
      } else {
        // elementFormDefault="qualified" in all three schemas: a local element is in `ns`.
        const parentNs = key.slice(0, key.indexOf(':'));
        if (PREFIX[ns] !== parentNs)
          throw new Error(`local element in another namespace at ${key}`);
        childKey = `${key}/${c.getAttribute('name')}`;
        pos.children.add(childKey);
        elementPosition(childKey, c, ns, stack);
      }
      const max = mult * maxOf(c);
      pos.maxOccurs.set(childKey, (pos.maxOccurs.get(childKey) ?? 0) + max);
      if (max !== 1) onlyElements = false;
      members.push(childKey);
    } else if (c.localName === 'any') {
      onlyElements = false;
      pos.wildcard = true; // a wildcard declares no names
    }
  }
  if (model.localName === 'choice' && mult === 1 && onlyElements && members.length > 1) {
    pos.choices.push([...members].sort());
  }
}

function attribute(a: Element, ns: string, pos: Position): void {
  const ref = a.getAttribute('ref');
  if (ref !== null) {
    const key = resolve(a, ref);
    pos.attrs.set(key, attrSpec(need(globals.attribute, key, 'attribute').el));
    return;
  }
  const name = a.getAttribute('name') ?? '';
  pos.attrs.set(a.getAttribute('form') === 'qualified' ? `{${ns}}${name}` : name, attrSpec(a));
}

// ---- output -----------------------------------------------------------------------------------

function render(retrieved: string): string {
  const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const spec = (s: AttrSpec) =>
    s === 'string' ? 'S' : s === 'yesNo' ? 'Y' : `{ enum: [${s.enum.map(q).join(', ')}] }`;
  const lines = [...positions.keys()].sort().map((key) => {
    const p = positions.get(key)!;
    const attrs = [...p.attrs.keys()].sort().map((a) => `${q(a)}: ${spec(p.attrs.get(a)!)}`);
    const children = [...p.children].sort().map(q);
    const once = [...p.children]
      .sort()
      .filter((c) => p.maxOccurs.get(c) === 1)
      .map(q);
    const extra =
      (once.length ? `, once: [${once.join(', ')}]` : '') +
      (p.choices.length
        ? `, choices: [${p.choices.map((g) => `[${g.map(q).join(', ')}]`).join(', ')}]`
        : '') +
      (p.text ? ', text: true' : '') +
      (p.wildcard ? ', wildcard: true' : '') +
      (p.anyAttribute === undefined ? '' : `, anyAttribute: ${q(p.anyAttribute)}`);
    return `  ${q(key)}: { attrs: { ${attrs.join(', ')} }, children: [${children.join(', ')}]${extra} },`;
  });
  return `// GENERATED by packages/core/scripts/gen-ms-ipff2.ts. Do not edit; run
// \`pnpm --filter @afterlife/core gen:ms-ipff2\` instead.
//
// Source: [MS-IPFF2] InfoPath Form Template Format Version 2, protocol revision 6.0 (2021-10-05),
// Microsoft Open Specifications, retrieved ${retrieved}:
${SECTIONS.map((s) => `// - section ${s.section}, ${s.title}: ${BASE}${s.id}`).join('\n')}
//
// This file holds only element names, attribute names and enumeration values from those XSDs,
// copied to implement the format, which the Microsoft Open Specifications notice allows. It holds
// no prose from the specification and no XSD text.
//
// Keys are element positions: a global element is \`xsf:rule\`; a local element is
// \`<parent key>/<local name>\` (all three schemas use elementFormDefault="qualified", so a local
// element is in its parent's namespace). Attribute keys are local names, or \`{uri}local\` for
// qualified attributes. An attribute is 'yesNo' (typed xdYesNo), an explicit enumeration, or
// 'string' (anything else, patterns and lists included).
//
// \`once\` lists the children whose effective maxOccurs is 1 (the product of maxOccurs through every
// enclosing particle, summed when a child appears in several). \`choices\` lists groups of
// children that sit in one xsd:choice that occurs at most once, so at most one of them can occur.
//
// Content flags: \`text: true\` marks content that allows characters (a simple type, simple
// content, mixed content, or xsd:anyType). \`wildcard: true\` marks content that allows any element
// (an xsd:any particle, or an element with no type, which is xsd:anyType). \`anyAttribute\` is the
// namespace constraint of an xsd:anyAttribute as written ('##any' when absent, and for
// xsd:anyType). The wildcards declare no names.

export type Ipff2Attr = 'string' | 'yesNo' | { readonly enum: readonly string[] };

export interface Ipff2Element {
  readonly attrs: Readonly<Record<string, Ipff2Attr>>;
  /** Keys of the child positions. */
  readonly children: readonly string[];
  /** Children that can occur at most once here (effective maxOccurs 1). */
  readonly once?: readonly string[];
  /** Groups of children of which at most one can occur (an xsd:choice occurring once). */
  readonly choices?: readonly (readonly string[])[];
  /** The content allows characters (simple type, simple content, mixed, or xsd:anyType). */
  readonly text?: true;
  /** The content allows any element (xsd:any, or xsd:anyType). */
  readonly wildcard?: true;
  /** Namespace constraint of an xsd:anyAttribute, as written. */
  readonly anyAttribute?: string;
}

/** The values of xdYesNo. */
export const XD_YES_NO: readonly string[] = [${(simpleSpec(globals.simpleType.get(YES_NO)!.el, new Set()) as { enum: string[] }).enum.map(q).join(', ')}];

const S = 'string';
const Y = 'yesNo';

export const MS_IPFF2: Readonly<Record<string, Ipff2Element>> = {
${lines.join('\n')}
};
`;
}

const parser = new DOMParser();
for (const s of SECTIONS) {
  const text = await fetchXsd(s.id);
  const doc = parser.parseFromString(text, 'text/xml');
  index(doc.documentElement!);
}
for (const [key, decl] of globals.element) {
  const [, uri, local] = /^\{(.*)\}(.*)$/.exec(key)!;
  elementPosition(qnameKey(uri!, local!), decl.el, decl.ns, []);
}
const retrieved = new Date().toISOString().slice(0, 10);
writeFileSync(OUT, render(retrieved));

const all = [...positions.values()].flatMap((p) => [...p.attrs.values()]);
console.log(
  `${positions.size} element positions, ${all.length} attributes: ` +
    `${all.filter((a) => a === 'yesNo').length} yesNo, ${all.filter((a) => typeof a === 'object').length} enumerations`,
);
