// Location path → field or group id (spec 02 R11.2, R11.4, design §7.2–§7.3). Names are matched
// by expanded name: a prefix is looked up in the scope of the string (Manifest.namespaces, or the
// XSL element that holds it), never compared as text (E1).

import type { XmlElement } from '../../xml/node';
import type { NameIndex } from '../data-tree';
import type { DataSource, UnresolvedRef } from '../types';
import {
  parseExpression,
  wholePath,
  XPathLexError,
  type LocationPath,
  type ParsedExpr,
  type Step,
} from './tokens';

export type Reason = UnresolvedRef['reason'];

/** prefix → namespace URI, `null` when unbound. */
export type Scope = (prefix: string) => string | null;

export const manifestScope =
  (namespaces: Readonly<Record<string, string>>): Scope =>
  (p) =>
    Object.hasOwn(namespaces, p) && p !== '' ? namespaces[p]! : null;

export const elementScope =
  (el: XmlElement): Scope =>
  (p) =>
    el.lookupNamespace(p);

export interface ResolveEnv {
  readonly index: NameIndex;
  readonly parentOf: ReadonlyMap<string, string>;
}

/** A node in one data source; `null` is the document node. */
export interface Ctx {
  readonly ds: DataSource;
  readonly node: string | null;
}

export interface ResolvedRef {
  readonly targetId: string;
  readonly text: string;
}
export interface FailedRef {
  readonly text: string;
  readonly reason: Reason;
}
export interface Resolution {
  readonly refs: readonly ResolvedRef[];
  readonly unresolved: readonly FailedRef[];
  /** The id, when the whole string is one location path that resolved. */
  readonly whole?: string;
  /** Its node with its data source. */
  readonly wholeCtx?: Ctx;
}

type Hit = { readonly ctx: Ctx } | { readonly reason: Reason };

function step(s: Step, at: Ctx, scope: Scope, env: ResolveEnv): Hit {
  if (s.descendant) return { reason: 'descendant' };
  if (s.axis === 'self') return { ctx: at };
  if (s.axis === 'parent') {
    if (at.node === null) return { reason: 'aboveRoot' };
    return { ctx: { ds: at.ds, node: env.parentOf.get(at.node) ?? null } };
  }
  if (s.axis !== 'child' && s.axis !== 'attribute') return { reason: 'axis' };
  if ('nodeType' in s.test) {
    // `x/text()` is the text of x: the same field. Any other node test is a wildcard.
    return s.test.nodeType === 'text' && s.axis === 'child' ? { ctx: at } : { reason: 'wildcard' };
  }
  if (s.test.local === '*') return { reason: 'wildcard' };
  let ns: string | null = null;
  if (s.test.prefix !== undefined) {
    ns = scope(s.test.prefix);
    if (ns === null) return { reason: 'unknownPrefix' };
  }
  const id = env.index.get(
    at.ds,
    at.node,
    s.axis === 'attribute' ? 'attribute' : 'element',
    ns,
    s.test.local,
  );
  return id === undefined ? { reason: 'notInTree' } : { ctx: { ds: at.ds, node: id } };
}

/**
 * Resolves every path of `e` (predicates included) against `ctx`. `exprCtx` is the context of the
 * whole expression, for `current()`.
 */
function resolveParsed(
  src: string,
  e: ParsedExpr,
  ctx: Ctx,
  exprCtx: Ctx,
  scope: Scope,
  env: ResolveEnv,
  out: { refs: (ResolvedRef & { pos: number })[]; unresolved: (FailedRef & { pos: number })[] },
): Map<LocationPath, Ctx> {
  const hits = new Map<LocationPath, Ctx>();
  for (const s of e.stringExpressions) {
    out.unresolved.push({ text: src.slice(s.pos, s.end), reason: 'stringExpression', pos: s.pos });
  }
  for (const p of e.paths) {
    const text = src.slice(p.pos, p.end);
    let at: Hit;
    switch (p.start.kind) {
      case 'absolute':
        at = { ctx: { ds: ctx.ds, node: null } };
        break;
      case 'relative':
        at = { ctx };
        break;
      case 'current':
        at = { ctx: exprCtx };
        break;
      case 'getDom':
        at = env.index.roots.has(p.start.name)
          ? { ctx: { ds: p.start.name, node: null } }
          : { reason: 'unknownDataSource' };
        break;
      case 'dynamicGetDom':
        at = { reason: 'dynamicGetDom' };
        break;
      case 'variable':
        at = { reason: 'variable' };
        break;
      case 'filter':
        at = { reason: 'notInTree' };
        break;
    }
    for (const s of p.steps) {
      if ('ctx' in at) at = step(s, at.ctx, scope, env);
      // Predicates: relative paths from this step's node; when the step failed, they fail too.
      for (const pred of s.predicates) {
        if ('ctx' in at) {
          resolveParsed(src, pred, at.ctx, exprCtx, scope, env, out);
        } else {
          const inner = { refs: [], unresolved: [] } as typeof out;
          resolveParsed(src, pred, { ds: '\u0000', node: null }, exprCtx, scope, env, inner);
          out.refs.push(...inner.refs);
          for (const u of inner.unresolved) {
            out.unresolved.push(u.reason === 'notInTree' ? { ...u, reason: at.reason } : u);
          }
        }
      }
    }
    if ('ctx' in at && at.ctx.node === null) at = { reason: 'notInTree' };
    if ('ctx' in at) {
      out.refs.push({ targetId: at.ctx.node!, text, pos: p.pos });
      hits.set(p, at.ctx);
    } else out.unresolved.push({ text, reason: at.reason, pos: p.pos });
  }
  return hits;
}

/** Every reference in `text`, in text order. A string that does not lex is one `notInTree`. */
export function resolveExpression(
  text: string,
  ctx: Ctx,
  scope: Scope,
  env: ResolveEnv,
  exprCtx: Ctx = ctx,
): Resolution {
  let parsed: ParsedExpr;
  try {
    parsed = parseExpression(text);
  } catch (e) {
    if (e instanceof XPathLexError)
      return { refs: [], unresolved: [{ text, reason: 'notInTree' }] };
    throw e;
  }
  const out = { refs: [], unresolved: [] } as Parameters<typeof resolveParsed>[6];
  const hits = resolveParsed(text, parsed, ctx, exprCtx, scope, env, out);
  const whole = wholePath(text, parsed);
  const wholeCtx = whole && hits.get(whole);
  const byPos = <T extends { pos: number }>(a: T, b: T) => a.pos - b.pos;
  const strip = <T extends { pos: number }>(x: T): Omit<T, 'pos'> => {
    const { pos, ...rest } = x;
    void pos;
    return rest;
  };
  return {
    refs: out.refs.sort(byPos).map(strip),
    unresolved: out.unresolved.sort(byPos).map(strip),
    ...(wholeCtx === undefined ? {} : { whole: wholeCtx.node!, wholeCtx }),
  };
}

/**
 * The node of an absolute path such as a calculation `target` or a validation `match`, then
 * `then` applied as a relative path (design §7.2).
 */
export function contextFor(
  path: string,
  then: string | undefined,
  scope: Scope,
  env: ResolveEnv,
  ds: DataSource = 'main',
): Ctx | { readonly reason: Reason } {
  const doc: Ctx = { ds, node: null };
  const r = resolveExpression(path, doc, scope, env);
  if (r.wholeCtx === undefined) return { reason: r.unresolved[0]?.reason ?? 'notInTree' };
  const at = r.wholeCtx;
  if (then === undefined || then.trim() === '' || then.trim() === '.') return at;
  const t = resolveExpression(then, at, scope, env);
  return t.wholeCtx ?? { reason: t.unresolved[0]?.reason ?? 'notInTree' };
}
