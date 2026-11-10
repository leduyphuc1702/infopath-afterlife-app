// XPath 1.0 tokenizer and location-path grouping for the dependency index (spec 02 R11.1, design
// §7.1). Not an XPath parser: it finds the location paths in an expression and nothing else.

export interface QName {
  readonly prefix?: string;
  readonly local: string; // '*' for a wildcard
}

type Tok =
  | { t: 'str'; v: string }
  | { t: 'num' }
  | { t: 'slash' | 'dslash' | 'dot' | 'dotdot' | 'at' }
  | { t: 'axis'; v: string }
  | { t: 'name'; q: QName }
  | { t: 'var' }
  | { t: 'func'; q: QName }
  | { t: 'nodetype'; v: string }
  | { t: 'op'; v: string };
export type Token = Tok & { readonly pos: number; readonly end: number };

export class XPathLexError extends Error {
  constructor(readonly pos: number) {
    super(`XPath lex error at ${pos}`);
  }
}

const NC_START = /[A-Za-z_\u00C0-\uFFFF]/;
const NC_CHAR = /[A-Za-z0-9_.\-\u00B7\u00C0-\uFFFF]/;
const OPERATOR_NAMES = new Set(['and', 'or', 'div', 'mod']);
const NODE_TYPES = new Set(['node', 'text', 'comment', 'processing-instruction']);
const TWO = ['!=', '<=', '>=', '//', '..', '::'];

/** XPath 1.0 §3.7: an operand ends here, so `*` and operator names after it are operators. */
function afterOperand(prev: Token | undefined): boolean {
  if (!prev) return false;
  if (prev.t === 'op') return prev.v === ')' || prev.v === ']';
  return ['name', 'str', 'num', 'dot', 'dotdot', 'var'].includes(prev.t);
}

export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const ncname = (from: number) => {
    let j = from;
    if (!NC_START.test(s[j] ?? '')) return from;
    while (j < s.length && NC_CHAR.test(s[j]!)) j++;
    return j;
  };
  const skipWs = (from: number) => {
    let j = from;
    while (j < s.length && /\s/.test(s[j]!)) j++;
    return j;
  };
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const pos = i;
    const push = (tok: Tok, end: number) => {
      out.push({ ...tok, pos, end });
      i = end;
    };
    const prev = out[out.length - 1];
    if (c === '"' || c === "'") {
      const close = s.indexOf(c, i + 1);
      if (close < 0) throw new XPathLexError(i);
      push({ t: 'str', v: s.slice(i + 1, close) }, close + 1);
      continue;
    }
    if (/\d/.test(c) || (c === '.' && /\d/.test(s[i + 1] ?? ''))) {
      const m = /^\d*\.?\d*/.exec(s.slice(i))!;
      push({ t: 'num' }, i + m[0].length);
      continue;
    }
    const two = s.slice(i, i + 2);
    if (TWO.includes(two)) {
      if (two === '//') push({ t: 'dslash' }, i + 2);
      else if (two === '..') push({ t: 'dotdot' }, i + 2);
      else if (two === '::') throw new XPathLexError(i);
      else push({ t: 'op', v: two }, i + 2);
      continue;
    }
    if (c === '/') {
      push({ t: 'slash' }, i + 1);
      continue;
    }
    if (c === '.') {
      push({ t: 'dot' }, i + 1);
      continue;
    }
    if (c === '@') {
      push({ t: 'at' }, i + 1);
      continue;
    }
    if ('=<>+-|,()[]'.includes(c)) {
      push({ t: 'op', v: c }, i + 1);
      continue;
    }
    if (c === '*') {
      push(afterOperand(prev) ? { t: 'op', v: '*' } : { t: 'name', q: { local: '*' } }, i + 1);
      continue;
    }
    if (c === '$') {
      let j = ncname(i + 1);
      if (j === i + 1) throw new XPathLexError(i);
      if (s[j] === ':' && ncname(j + 1) > j + 1) j = ncname(j + 1);
      push({ t: 'var' }, j);
      continue;
    }
    const e1 = ncname(i);
    if (e1 > i) {
      const first = s.slice(i, e1);
      if (afterOperand(prev) && OPERATOR_NAMES.has(first) && s[e1] !== ':') {
        push({ t: 'op', v: first }, e1);
        continue;
      }
      const ws = skipWs(e1);
      if (s.slice(ws, ws + 2) === '::') {
        push({ t: 'axis', v: first }, ws + 2);
        continue;
      }
      let q: QName = { local: first };
      let end = e1;
      if (s[e1] === ':' && s[e1 + 1] === '*') {
        q = { prefix: first, local: '*' };
        end = e1 + 2;
      } else if (s[e1] === ':' && ncname(e1 + 1) > e1 + 1) {
        end = ncname(e1 + 1);
        q = { prefix: first, local: s.slice(e1 + 1, end) };
      }
      if (s[skipWs(end)] === '(' && q.local !== '*') {
        if (q.prefix === undefined && NODE_TYPES.has(q.local))
          push({ t: 'nodetype', v: q.local }, end);
        else push({ t: 'func', q }, end);
        continue;
      }
      push({ t: 'name', q }, end);
      continue;
    }
    throw new XPathLexError(i);
  }
  return out;
}

// ---- grouping ---------------------------------------------------------------------------------

export interface Step {
  /** `child`, `attribute`, `self`, `parent`, or any other axis name as written. */
  readonly axis: string;
  /** A name test, or a node-type test such as `node()`. */
  readonly test: QName | { readonly nodeType: string };
  /** Reached through `//`. */
  readonly descendant: boolean;
  readonly predicates: readonly ParsedExpr[];
}

export type PathStart =
  | { readonly kind: 'absolute' }
  | { readonly kind: 'relative' }
  | { readonly kind: 'current' }
  | { readonly kind: 'getDom'; readonly name: string }
  | { readonly kind: 'dynamicGetDom' }
  | { readonly kind: 'variable' }
  /** A path after a filter expression such as `(…)/x` or `f()/x`. */
  | { readonly kind: 'filter' };

export interface LocationPath {
  readonly start: PathStart;
  readonly steps: readonly Step[];
  /** Source offsets of the whole path, predicates included. */
  readonly pos: number;
  readonly end: number;
}

export interface ParsedExpr {
  readonly paths: readonly LocationPath[];
  /** String arguments that hold an expression (`xdMath:Eval`'s second argument). */
  readonly stringExpressions: readonly { readonly pos: number; readonly end: number }[];
}

/** The whole string is one location path (leading and trailing whitespace aside). */
export function wholePath(s: string, e: ParsedExpr): LocationPath | undefined {
  if (e.paths.length !== 1 || e.stringExpressions.length) return undefined;
  const p = e.paths[0]!;
  return s.slice(0, p.pos).trim() === '' && s.slice(p.end).trim() === '' ? p : undefined;
}

export function parseExpression(s: string): ParsedExpr {
  return group(tokenize(s), 0, Infinity).expr;
}

function isOp(t: Token | undefined, v: string): boolean {
  return t?.t === 'op' && t.v === v;
}

/** Index of the token that closes the bracket opened at `open`. */
function closing(toks: readonly Token[], open: number, o: string, c: string): number {
  let depth = 0;
  for (let i = open; i < toks.length; i++) {
    if (isOp(toks[i], o)) depth++;
    else if (isOp(toks[i], c) && --depth === 0) return i;
  }
  throw new XPathLexError(toks[open]!.pos);
}

const STEP_START = new Set(['name', 'dot', 'dotdot', 'at', 'axis', 'nodetype']);

function group(toks: readonly Token[], from: number, to: number) {
  const paths: LocationPath[] = [];
  const stringExpressions: { pos: number; end: number }[] = [];
  const stop = Math.min(to, toks.length);
  let i = from;
  while (i < stop) {
    const tok = toks[i]!;
    const prev = i > from ? toks[i - 1] : undefined;
    const startPos = !afterOperand(prev);
    if (tok.t === 'func') {
      const local = tok.q.local;
      if (local === 'GetDOM' && isOp(toks[i + 1], '(')) {
        const close = closing(toks, i + 1, '(', ')');
        const arg = toks.slice(i + 2, close);
        const name = arg.length === 1 && arg[0]!.t === 'str' ? arg[0]!.v : undefined;
        const after = toks[close + 1];
        if (after?.t === 'slash' || after?.t === 'dslash') {
          const r = steps(toks, close + 1, stop);
          paths.push({
            start: name === undefined ? { kind: 'dynamicGetDom' } : { kind: 'getDom', name },
            steps: r.steps,
            pos: tok.pos,
            end: r.end,
          });
          i = r.next;
        } else {
          i = close + 1;
        }
        continue;
      }
      if (local === 'current' && isOp(toks[i + 1], '(') && isOp(toks[i + 2], ')')) {
        const after = toks[i + 3];
        if (after?.t === 'slash' || after?.t === 'dslash') {
          const r = steps(toks, i + 3, stop);
          paths.push({ start: { kind: 'current' }, steps: r.steps, pos: tok.pos, end: r.end });
          i = r.next;
        } else i += 3;
        continue;
      }
      if (local === 'Eval' && isOp(toks[i + 1], '(')) {
        const close = closing(toks, i + 1, '(', ')');
        let depth = 0;
        let comma = -1;
        for (let j = i + 2; j < close; j++) {
          if (isOp(toks[j], '(') || isOp(toks[j], '[')) depth++;
          else if (isOp(toks[j], ')') || isOp(toks[j], ']')) depth--;
          else if (depth === 0 && isOp(toks[j], ',')) {
            comma = j;
            break;
          }
        }
        if (comma >= 0 && comma + 1 < close) {
          stringExpressions.push({ pos: toks[comma + 1]!.pos, end: toks[close - 1]!.end });
        }
      }
      i++;
      continue;
    }
    if (tok.t === 'var' && (toks[i + 1]?.t === 'slash' || toks[i + 1]?.t === 'dslash')) {
      const r = steps(toks, i + 1, stop);
      paths.push({ start: { kind: 'variable' }, steps: r.steps, pos: tok.pos, end: r.end });
      i = r.next;
      continue;
    }
    if (tok.t === 'slash' || tok.t === 'dslash') {
      const r = steps(toks, i, stop);
      const filter = isOp(prev, ')') || isOp(prev, ']');
      paths.push({
        start: filter ? { kind: 'filter' } : { kind: 'absolute' },
        steps: r.steps,
        pos: tok.pos,
        end: r.end,
      });
      i = r.next;
      continue;
    }
    if (startPos && STEP_START.has(tok.t)) {
      const r = steps(toks, i, stop, true);
      paths.push({ start: { kind: 'relative' }, steps: r.steps, pos: tok.pos, end: r.end });
      i = r.next;
      continue;
    }
    i++;
  }
  return { expr: { paths, stringExpressions } as ParsedExpr };
}

/** Steps from `i`; `i` is a `/`, `//` or (for a relative path) the first step. */
function steps(toks: readonly Token[], from: number, stop: number, relative = false) {
  let i = from;
  const out: Step[] = [];
  let end = toks[i]!.end;
  let descendant = false;
  let expectStep = relative;
  while (i < stop) {
    const tok = toks[i]!;
    if (!expectStep) {
      if (tok.t === 'slash' || tok.t === 'dslash') {
        descendant = tok.t === 'dslash';
        end = tok.end;
        expectStep = true;
        i++;
        continue;
      }
      break;
    }
    let axis = 'child';
    let j = i;
    if (tok.t === 'dot' || tok.t === 'dotdot') {
      out.push({
        axis: tok.t === 'dot' ? 'self' : 'parent',
        test: { nodeType: 'node' },
        descendant,
        predicates: [],
      });
      end = tok.end;
      i++;
      descendant = false;
      expectStep = false;
      continue;
    }
    if (tok.t === 'at') {
      axis = 'attribute';
      j++;
    } else if (tok.t === 'axis') {
      axis = tok.v;
      j++;
    }
    const test = toks[j];
    let stepTest: Step['test'];
    if (test?.t === 'name') {
      stepTest = test.q;
      end = test.end;
      j++;
    } else if (test?.t === 'nodetype' && isOp(toks[j + 1], '(')) {
      const close = closing(toks, j + 1, '(', ')');
      stepTest = { nodeType: test.v };
      end = toks[close]!.end;
      j = close + 1;
    } else {
      break; // a `/` with no step after it (the root alone), or a malformed step
    }
    const predicates: ParsedExpr[] = [];
    while (isOp(toks[j], '[')) {
      const close = closing(toks, j, '[', ']');
      predicates.push(group(toks, j + 1, close).expr);
      end = toks[close]!.end;
      j = close + 1;
    }
    out.push({ axis, test: stepTest, descendant, predicates });
    descendant = false;
    expectStep = false;
    i = j;
  }
  return { steps: out, end, next: i === from ? from + 1 : i };
}
