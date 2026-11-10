import { describe, expect, test } from 'vitest';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { XSF_VOCABULARY } from '../../src/xsf/vocabulary';
import { kitchenSink } from '../helpers/kitchen-sink';

// Design §8.5: every table entry is built into the output. The kitchen sink, generated from the
// table, holds every spec key with every attribute; after parsing, every generated element path is
// an object with that path in the result, its attrs hold every generated attribute, and there are
// no unknown entries and no issues.

const sink = kitchenSink();
const parsed = parseManifest(new TextEncoder().encode(sink.xml));

/** path → attribute names, from every object in the result that has a path and attrs (§8.4). */
function modelledSet(
  value: unknown,
  out = new Map<string, Set<string>>(),
): Map<string, Set<string>> {
  if (Array.isArray(value)) value.forEach((v) => modelledSet(v, out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.path === 'string' && o.attrs && typeof o.attrs === 'object') {
      const names = out.get(o.path) ?? new Set<string>();
      Object.keys(o.attrs).forEach((n) => names.add(n));
      out.set(o.path, names);
    }
    Object.values(o).forEach((v) => modelledSet(v, out));
  }
  return out;
}

const modelled = modelledSet(parsed.manifest);

test('every spec key is placed at least once', () => {
  const placed = new Set(sink.elements.map((e) => e.key));
  expect(Object.keys(XSF_VOCABULARY).filter((k) => !placed.has(k))).toEqual([]);
});

test('parsing gives no unknown entries and no issues (and no INTERNAL error)', () => {
  expect(parsed.unknowns.map((u) => `${u.reason} ${u.path}`)).toEqual([]);
  expect(parsed.issues).toEqual([]);
});

test('the result holds exactly the generated elements', () => {
  expect([...modelled.keys()].sort()).toEqual(sink.elements.map((e) => e.path).sort());
});

describe.each(sink.elements.map((e) => [e.path, e] as const))('%s', (path, e) => {
  test(`${e.key}: an object with this path, carrying every attribute`, () => {
    expect(modelled.has(path)).toBe(true);
    expect([...modelled.get(path)!].sort()).toEqual([...e.attrs].sort());
  });
});
