// Inputs for property P12 (design §13.3, R20): a README manifest and a list of insertions, as a
// JSON descriptor, applied to the manifest's DOM by `mutate`. Targets are integers taken modulo
// the eligible elements at the moment each insertion is applied, so they shrink towards the root.
//
// Eligible targets exclude the payload of modelled raw-XML elements (`chooseFragment`, `header`,
// `footer`): content there is kept verbatim in `raw` (R13.5), so it is neither modelled nor
// unknown, and an insertion there would be payload too.

import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import fc from 'fast-check';
import { XSF_VOCABULARY } from '../../src/xsf/vocabulary';

export const NAMESPACES = {
  xsf: 'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition',
  xsf2: 'http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions',
  xsf3: 'http://schemas.microsoft.com/office/infopath/2009/solutionDefinition/extensions',
  r0: 'urn:p12:random-a',
  r1: 'urn:p12:random-b',
  r2: 'http://example.invalid/p12',
} as const;
type Ns = keyof typeof NAMESPACES;
/** Prefixes declared on the root for each namespace; distinct from anything in the samples. */
const PREFIX: Record<Ns, string> = {
  xsf: 'q0',
  xsf2: 'q2',
  xsf3: 'q3',
  r0: 'p0',
  r1: 'p1',
  r2: 'p2',
};

export interface GenAttribute {
  ns: Ns | null;
  local: string;
  value: string;
}

export interface GenElement {
  ns: Ns;
  local: string;
  attrs: GenAttribute[];
  children: GenElement[];
}

export type Insertion =
  | { op: 'element'; target: number; position: number; element: GenElement }
  | { op: 'attribute'; target: number; attribute: GenAttribute }
  /** A deep copy of an eligible element (not the root), placed right after it. */
  | { op: 'repeat'; target: number };

export interface P12Input {
  /** Index among the README manifests. */
  manifest: number;
  insertions: Insertion[];
}

const POS = fc.integer({ min: 0, max: 0x7fff_ffff });
const ns = fc.constantFrom<Ns>('xsf', 'xsf2', 'xsf3', 'r0', 'r1', 'r2');
const ncName = fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_.-]{0,8}$/).filter((s) => !/^xml/i.test(s));
const value = fc.string({
  unit: fc.constantFrom('a', 'Z', '0', ' ', '.', '/', ':', '&', '<', '>', '"', "'", 'é'),
  maxLength: 8,
});

/** Real vocabulary element names (`prefix:local`, no nested child keys), for wrong places. */
const vocabularyNames = Object.keys(XSF_VOCABULARY)
  .filter((k) => !k.includes('/'))
  .map((k) => k.split(':') as [Ns, string]);
const vocabularyName = fc.constantFrom(...vocabularyNames);

const attribute: fc.Arbitrary<GenAttribute> = fc.record({
  ns: fc.option(ns, { nil: null, freq: 3 }),
  local: ncName,
  value,
});

const element: fc.Arbitrary<GenElement> = fc.letrec<{ el: GenElement }>((tie) => ({
  el: fc
    .record({
      name: fc.oneof(
        { weight: 3, arbitrary: fc.tuple(ns, ncName) },
        { weight: 1, arbitrary: vocabularyName },
      ),
      attrs: fc.array(attribute, { maxLength: 3 }),
      children: fc.oneof(
        { maxDepth: 3, depthIdentifier: 'p12-element', withCrossShrink: true },
        fc.constant<GenElement[]>([]),
        fc.array(tie('el'), { maxLength: 2 }),
      ),
    })
    .map(({ name, attrs, children }) => ({ ns: name[0], local: name[1], attrs, children })),
})).el;

/** Depth 0–3 below the inserted element (R20.1, design §13.3). */
const depth = (e: GenElement): number => 1 + Math.max(0, ...e.children.map(depth));
const insertion: fc.Arbitrary<Insertion> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      op: fc.constant('element' as const),
      target: POS,
      position: POS,
      element: element.filter((e) => depth(e) <= 4),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ op: fc.constant('attribute' as const), target: POS, attribute }),
  },
  { weight: 1, arbitrary: fc.record({ op: fc.constant('repeat' as const), target: POS }) },
);

export function p12Input(manifests: number): fc.Arbitrary<P12Input> {
  return fc.record({
    manifest: fc.integer({ min: 0, max: manifests - 1 }),
    insertions: fc.array(insertion, { minLength: 1, maxLength: 20 }),
  });
}

export interface Mutated {
  xml: string;
  /** The inserted nodes, in the mutated DOM. Attributes as [owner, namespace, local]. */
  insertedElements: Element[];
  insertedAttributes: [Element, string | null, string][];
}

/**
 * Applies the insertions to `text`. `isPayload(el)` is true for modelled raw-XML elements of the
 * original manifest; they and their descendants are never targets, nor are copies of them.
 */
export function mutate(
  text: string,
  input: P12Input,
  isPayload: (el: Element, doc: Element) => boolean,
): Mutated {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const root = doc.documentElement!;
  for (const k of Object.keys(NAMESPACES) as Ns[]) {
    root.setAttributeNS('http://www.w3.org/2000/xmlns/', `xmlns:${PREFIX[k]}`, NAMESPACES[k]);
  }
  const payload = new Set<Element>();
  for (const el of elementsOf(root)) if (isPayload(el, root)) payload.add(el);

  const inserted: Element[] = [];
  const insertedAttributes: [Element, string | null, string][] = [];
  const eligible = () => elementsOf(root).filter((el) => !insidePayload(el, payload));

  for (const ins of input.insertions) {
    const targets = eligible();
    const target = targets[ins.target % targets.length]!;
    if (ins.op === 'element') {
      const kids = Array.from(target.childNodes);
      const before = kids[ins.position % (kids.length + 1)] ?? null;
      const el = build(doc, ins.element);
      target.insertBefore(el, before);
      inserted.push(el);
    } else if (ins.op === 'attribute') {
      const a = ins.attribute;
      const uri = a.ns === null ? null : NAMESPACES[a.ns];
      if (target.hasAttributeNS(uri, a.local)) continue;
      if (uri === null) target.setAttribute(a.local, a.value);
      else target.setAttributeNS(uri, `${PREFIX[a.ns!]}:${a.local}`, a.value);
      insertedAttributes.push([target, uri, a.local]);
    } else {
      if (target === root) continue;
      const copy = target.cloneNode(true) as Element;
      markCopies(target, copy, payload);
      target.parentNode!.insertBefore(copy, target.nextSibling);
      inserted.push(copy);
    }
  }
  return {
    xml: new XMLSerializer().serializeToString(doc),
    insertedElements: inserted,
    insertedAttributes,
  };
}

function build(doc: ReturnType<DOMParser['parseFromString']>, g: GenElement): Element {
  const el = doc.createElementNS(NAMESPACES[g.ns], `${PREFIX[g.ns]}:${g.local}`);
  for (const a of g.attrs) {
    const uri = a.ns === null ? null : NAMESPACES[a.ns];
    if (el.hasAttributeNS(uri, a.local)) continue; // a duplicate would not be well-formed XML
    if (uri === null) el.setAttribute(a.local, a.value);
    else el.setAttributeNS(uri, `${PREFIX[a.ns!]}:${a.local}`, a.value);
  }
  for (const c of g.children) el.appendChild(build(doc, c));
  return el;
}

export function elementsOf(root: Element): Element[] {
  const out: Element[] = [];
  const visit = (el: Element) => {
    out.push(el);
    for (const c of Array.from(el.childNodes)) if (c.nodeType === 1) visit(c as Element);
  };
  visit(root);
  return out;
}

function insidePayload(el: Element, payload: ReadonlySet<Element>): boolean {
  for (let n: Element | null = el; n; n = n.parentNode as Element | null) {
    if (payload.has(n)) return true;
    if (n.nodeType !== 1) return false;
  }
  return false;
}

/** A copy of a payload element is payload too. */
function markCopies(original: Element, copy: Element, payload: Set<Element>): void {
  const a = elementsOf(original);
  const b = elementsOf(copy);
  a.forEach((el, i) => {
    if (payload.has(el)) payload.add(b[i]!);
  });
}
