// Does a simple type accept the empty string? (design §9.3, R14.4). Used for `required`: a field
// whose type accepts '' is not required, because an empty element is valid.
//
// Built-ins follow XML Schema 1.0 Part 2: the string family without a length bound, anyURI,
// base64Binary, hexBinary and anySimpleType accept ''; NMTOKENS, IDREFS and ENTITIES are lists
// restricted with minLength 1 (Part 2 §3.3, checked 2026-11-10), so they do not; every other
// built-in does not. A restriction can only narrow.

import type { TypeName } from './types';

export interface SimpleFacet {
  readonly name: string;
  readonly value: string;
  /** The restriction step this facet belongs to (patterns and enumerations in one step are ORed). */
  readonly step: string;
}

export interface SimpleTypeInfo {
  readonly builtin: TypeName;
  readonly variety: 'atomic' | 'list' | 'union';
  /** Base type's first, in declaration order. */
  readonly facets: readonly SimpleFacet[];
  /** Union only: each member, with its own facets. */
  readonly members?: readonly SimpleTypeInfo[];
}

/** A pattern that uses XML Schema syntax with no JavaScript equivalent. */
export interface UnevaluatedPattern {
  readonly pattern: string;
  readonly step: string;
}

export type EmptyResult =
  | { readonly accepts: boolean }
  | { readonly accepts: 'unknown'; readonly unevaluated: readonly UnevaluatedPattern[] };

const ACCEPTS_EMPTY = new Set([
  'xsd:string',
  'xsd:normalizedString',
  'xsd:token',
  'xsd:anyURI',
  'xsd:base64Binary',
  'xsd:hexBinary',
  'xsd:anySimpleType',
]);

export function acceptsEmpty(t: SimpleTypeInfo): EmptyResult {
  let base: EmptyResult;
  if (t.variety === 'list')
    base = { accepts: true }; // zero items
  else if (t.variety === 'union') base = union(t.members ?? []);
  else base = { accepts: ACCEPTS_EMPTY.has(t.builtin) };
  return narrow(base, t.facets);
}

function union(members: readonly SimpleTypeInfo[]): EmptyResult {
  const unevaluated: UnevaluatedPattern[] = [];
  for (const m of members) {
    const r = acceptsEmpty(m);
    if (r.accepts === true) return { accepts: true };
    if (r.accepts === 'unknown') unevaluated.push(...r.unevaluated);
  }
  return unevaluated.length ? { accepts: 'unknown', unevaluated } : { accepts: false };
}

function narrow(base: EmptyResult, facets: readonly SimpleFacet[]): EmptyResult {
  if (base.accepts === false) return base;
  const steps = new Map<string, SimpleFacet[]>();
  for (const f of facets) steps.set(f.step, [...(steps.get(f.step) ?? []), f]);

  const unevaluated: UnevaluatedPattern[] = base.accepts === 'unknown' ? [...base.unevaluated] : [];
  for (const [step, fs] of steps) {
    const enums = fs.filter((f) => f.name === 'enumeration');
    if (enums.length && !enums.some((f) => f.value === '')) return { accepts: false };
    for (const f of fs) {
      if ((f.name === 'length' || f.name === 'minLength') && Number(f.value.trim()) >= 1) {
        return { accepts: false };
      }
    }
    const patterns = fs.filter((f) => f.name === 'pattern');
    if (!patterns.length) continue;
    // Patterns of one step are alternatives; the step accepts '' if any of them does.
    let any = false;
    const unknownHere: UnevaluatedPattern[] = [];
    for (const p of patterns) {
      const re = toRegExp(p.value);
      if (re === undefined) unknownHere.push({ pattern: p.value, step });
      else if (re.test('')) any = true;
    }
    if (any) continue;
    if (!unknownHere.length) return { accepts: false };
    unevaluated.push(...unknownHere);
  }
  return unevaluated.length ? { accepts: 'unknown', unevaluated } : { accepts: true };
}

/**
 * An XML Schema 1.0 regular expression (Part 2 Appendix F) as an anchored JavaScript RegExp with
 * the `u` flag, or undefined when it uses syntax JavaScript cannot express: the name escapes
 * `\i \I \c \C`, block escapes `\p{Is…}`, or character-class subtraction `[…-[…]]`.
 * `^` and `$` are ordinary characters in XML Schema and are escaped outside character classes.
 */
export function toRegExp(pattern: string): RegExp | undefined {
  let out = '';
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '\\') {
      const n = pattern[i + 1];
      if (n === undefined) return undefined;
      if ('iIcC'.includes(n)) return undefined;
      if ((n === 'p' || n === 'P') && pattern.startsWith('{Is', i + 2)) return undefined;
      // XML Schema allows \- and \^ anywhere; with the u flag JavaScript allows \- only in a class.
      out += n === '-' && !inClass ? '-' : `\\${n}`;
      i++;
      continue;
    }
    if (inClass) {
      if (c === '-' && pattern[i + 1] === '[') return undefined;
      if (c === ']') inClass = false;
      out += c;
      continue;
    }
    if (c === '[') {
      inClass = true;
      out += c;
      if (pattern[i + 1] === '^') {
        out += '^';
        i++;
      }
      continue;
    }
    out += c === '^' || c === '$' ? `\\${c}` : c;
  }
  try {
    return new RegExp(`^(?:${out})$`, 'u');
  } catch {
    return undefined;
  }
}
