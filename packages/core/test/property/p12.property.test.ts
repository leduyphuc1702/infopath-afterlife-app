import { DOMParser, type Attr, type Element } from '@xmldom/xmldom';
import fc from 'fast-check';
import { expect, test } from 'vitest';
import type { UnknownEntry } from '../../src/index';
import { parseManifest, type ParsedManifest } from '../../src/xsf/parse-manifest';
import { sampleManifests } from '../helpers/manifests';
import { elementsOf, mutate, p12Input, type P12Input } from './p12-inputs';
import { P12_REGRESSIONS } from './regressions';

// Property P12 (design §13.3, R20): after random insertions into a README manifest, every element
// and non-xmlns attribute is either modelled or inside exactly one unknown entry, never both and
// never neither; each inserted node that is not modelled has its own entry whose path selects it.
//
// The oracle walks the mutated DOM with its own path code (below), not src/xml/path.ts and not
// the vocabulary table. "Modelled" is read from the result alone (design §8.4): an object in the
// manifest with that `path`, and its `attrs` keys. `unexpectedValue` entries annotate a modelled
// attribute and are not counted (R20.2); `repeated` entries are counted as unknown (R13.9).

const RUNS = 500;

const decoder = new TextDecoder();
const readme = (await sampleManifests())
  .filter((m) => m.own)
  .map((m) => ({ slug: m.slug, text: decoder.decode(m.bytes) }));

// ---- The oracle's own paths (glossary "Path", design §7.3) ------------------------------------

const KNOWN: Record<string, string> = {
  'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition': 'xsf',
  'http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions': 'xsf2',
  'http://schemas.microsoft.com/office/infopath/2009/solutionDefinition/extensions': 'xsf3',
  'http://www.w3.org/2001/XMLSchema': 'xsd',
  'http://www.w3.org/XML/1998/namespace': 'xml',
};
const XMLNS = 'http://www.w3.org/2000/xmlns/';

function qname(uri: string | null, local: string): string {
  if (!uri) return local;
  const p = KNOWN[uri];
  return p ? `${p}:${local}` : `{${uri}}${local}`;
}

function pathOf(el: Element): string {
  const parent = el.parentNode;
  const same = (n: Element) =>
    n.nodeType === 1 && n.namespaceURI === el.namespaceURI && n.localName === el.localName;
  if (!parent || parent.nodeType !== 1) return `/${qname(el.namespaceURI, el.localName!)}[1]`;
  const siblings = Array.from(parent.childNodes).filter((n) => same(n as Element));
  return `${pathOf(parent as Element)}/${qname(el.namespaceURI, el.localName!)}[${siblings.indexOf(el) + 1}]`;
}

const attrKey = (uri: string | null, local: string) => (uri ? `{${uri}}${local}` : local);

// ---- What the result says ---------------------------------------------------------------------

interface Accounted {
  /** path → modelled attribute keys. */
  modelled: Map<string, Set<string>>;
  /** Paths of modelled raw-XML elements: their content is payload (R13.5). */
  raw: Set<string>;
  /** notModelled and repeated entries, by path, with how many have that path. */
  unknown: Map<string, number>;
}

function accounted(parsed: ParsedManifest): Accounted {
  const modelled = new Map<string, Set<string>>();
  const raw = new Set<string>();
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.path === 'string' && o.attrs && typeof o.attrs === 'object') {
        const keys = modelled.get(o.path) ?? new Set<string>();
        Object.keys(o.attrs).forEach((k) => keys.add(k));
        modelled.set(o.path, keys);
        if (typeof o.raw === 'string') raw.add(o.path);
      }
      Object.values(o).forEach(visit);
    }
  };
  visit(parsed.manifest);
  const unknown = new Map<string, number>();
  for (const u of parsed.unknowns.filter(counted)) {
    unknown.set(u.path, (unknown.get(u.path) ?? 0) + 1);
  }
  return { modelled, raw, unknown };
}

const counted = (u: UnknownEntry) =>
  (u.reason === 'notModelled' || u.reason === 'repeated') && u.kind !== 'text';

// ---- The check --------------------------------------------------------------------------------

interface Stats {
  insertedElements: number;
  insertedAttributes: number;
  /** Inserted nodes that came out unknown with an entry of their own. */
  ownEntries: number;
  repeated: number;
  unexpectedValue: number;
}

const stats: Stats = {
  insertedElements: 0,
  insertedAttributes: 0,
  ownEntries: 0,
  repeated: 0,
  unexpectedValue: 0,
};

/** Returns the problems found; empty when P12 holds. */
function problems(p: P12Input): string[] {
  const base = readme[p.manifest % readme.length]!;
  const original = accounted(parseManifest(new TextEncoder().encode(base.text)));
  const m = mutate(base.text, p, (el) => original.raw.has(pathOf(el)));
  const parsed = parseManifest(new TextEncoder().encode(m.xml));
  const r = accounted(parsed);
  const out: string[] = [];
  stats.insertedElements += m.insertedElements.length;
  stats.insertedAttributes += m.insertedAttributes.length;
  stats.repeated += parsed.unknowns.filter((u) => u.reason === 'repeated').length;
  stats.unexpectedValue += parsed.unknowns.filter((u) => u.reason === 'unexpectedValue').length;

  for (const [path, n] of r.unknown) if (n > 1) out.push(`${n} unknown entries at ${path}`);

  // The DOM the parser saw: the same text, parsed again for the oracle's own walk.
  const root = new DOMParser().parseFromString(m.xml, 'text/xml').documentElement!;
  const domPaths = new Set<string>();
  /** How many entries have `path` or an ancestor's: the entries this node is inside. */
  const covering = (path: string) => {
    let n = 0;
    for (let q = path; q.includes('/'); q = q.slice(0, q.lastIndexOf('/'))) {
      n += r.unknown.get(q) ?? 0;
    }
    return n;
  };
  const unknownAncestor = (path: string) => covering(path) > 0;
  const insideRaw = (path: string) => {
    for (
      let q = path.slice(0, path.lastIndexOf('/'));
      q.includes('/');
      q = q.slice(0, q.lastIndexOf('/'))
    ) {
      if (r.raw.has(q)) return true;
    }
    return false;
  };

  for (const el of elementsOf(root)) {
    const path = pathOf(el);
    domPaths.add(path);
    const isModelled = r.modelled.has(path);
    const isUnknown = unknownAncestor(path);
    if (insideRaw(path)) {
      // Raw-XML payload: kept verbatim in its parent's `raw`, so neither modelled nor unknown.
      if (isModelled || isUnknown) out.push(`raw payload ${path} is also modelled or unknown`);
      continue;
    }
    if (isModelled === isUnknown) out.push(`${path}: modelled ${isModelled}, unknown ${isUnknown}`);
    if (covering(path) > 1) out.push(`${path} is inside ${covering(path)} unknown entries`);
    for (const a of Array.from<Attr>(el.attributes)) {
      if (a.namespaceURI === XMLNS || a.name === 'xmlns') continue;
      const at = `${path}/@${qname(a.namespaceURI, a.localName!)}`;
      domPaths.add(at);
      const aModelled = r.modelled.get(path)?.has(attrKey(a.namespaceURI, a.localName!)) ?? false;
      const aUnknown = r.unknown.has(at) || isUnknown;
      if (aModelled === aUnknown) out.push(`${at}: modelled ${aModelled}, unknown ${aUnknown}`);
      const aCovering = (r.unknown.get(at) ?? 0) + covering(path);
      if (aCovering > 1) out.push(`${at} is inside ${aCovering} unknown entries`);
    }
  }
  for (const path of r.unknown.keys()) {
    if (!domPaths.has(path)) out.push(`unknown entry ${path} selects no node`);
  }

  // R20.1: each inserted node that is not modelled, whose parent is modelled, has its own entry.
  // One inside an unknown subtree is part of that subtree's single entry (R13.1).
  for (const el of m.insertedElements) {
    const path = pathOf(el);
    if (r.modelled.has(path)) continue;
    const parent = path.slice(0, path.lastIndexOf('/'));
    if (unknownAncestor(parent)) continue;
    if (r.unknown.get(path) === 1) stats.ownEntries++;
    else out.push(`inserted ${path} has no entry of its own`);
  }
  for (const [owner, uri, local] of m.insertedAttributes) {
    const path = pathOf(owner);
    if (r.modelled.get(path)?.has(attrKey(uri, local))) continue;
    if (unknownAncestor(path)) continue;
    const at = `${path}/@${qname(uri, local)}`;
    if (r.unknown.get(at) === 1) stats.ownEntries++;
    else out.push(`inserted ${at} has no entry of its own`);
  }
  return out;
}

test('the README manifests are the 47 own forms', () => {
  expect(readme).toHaveLength(47);
});

test('every README manifest as it is: P12 holds with no insertions', () => {
  for (let i = 0; i < readme.length; i++) {
    expect(problems({ manifest: i, insertions: [] }), readme[i]!.slug).toEqual([]);
  }
});

test(`${RUNS} runs: every element and attribute is modelled or unknown, exactly once`, () => {
  let runs = 0;
  const t0 = performance.now();
  fc.assert(
    fc.property(p12Input(readme.length), (p) => {
      runs++;
      const found = problems(p);
      if (found.length) throw new Error(found.join('\n'));
    }),
    { numRuns: RUNS },
  );
  const s = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`P12: ${runs} runs in ${s} s; ${JSON.stringify(stats)}`);
  expect(runs).toBe(RUNS);
  // The generator reaches both R13.9 repeats and R13.4 values, so R20.2's rules for them ran.
  expect(stats.repeated).toBeGreaterThan(0);
  expect(stats.ownEntries).toBeGreaterThan(0);
}, 120_000);

test.each(P12_REGRESSIONS.map((r) => [r.note, r.case] as const))('regression: %s', (_note, p) => {
  expect(problems(p)).toEqual([]);
});
