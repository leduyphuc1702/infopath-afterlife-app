// Spec 04 R3, D5: InfoPath XPath against the session's documents. Every failure (an unknown
// function, an unknown prefix, a syntax error) becomes NotEvaluated; nothing guesses a value.

import { evaluateXPath, type XPathOut } from '../render/engine/xsltjs';
import type { Issue } from '../errors';
import { NS, runtimeFunctions } from './functions';
import type { FunctionTable } from '../render/engine/host';

/** An expression the runtime could not evaluate (R3.2). */
export class NotEvaluated extends Error {
  constructor(
    readonly expression: string,
    readonly reason: string,
  ) {
    super(`${expression}: ${reason}`);
  }
}

class UnknownFunction extends Error {}

/** The xmldom members the runtime reads and writes. */
export interface RtNode {
  readonly nodeType: number;
  readonly namespaceURI: string | null;
  readonly localName: string | null;
  readonly nodeName: string;
  readonly parentNode: RtNode | null;
  readonly ownerElement?: RtNode | null;
  readonly firstChild: RtNode | null;
  readonly nextSibling: RtNode | null;
  readonly previousSibling: RtNode | null;
  readonly childNodes: ArrayLike<RtNode>;
  readonly attributes?: ArrayLike<RtNode>;
  readonly documentElement?: RtNode | null;
  readonly ownerDocument: RtDocument | null;
  textContent: string | null;
  value?: string;
  getAttributeNS?(ns: string, local: string): string | null;
  removeAttributeNS?(ns: string, local: string): void;
  removeChild?(n: RtNode): RtNode;
  appendChild?(n: RtNode): RtNode;
}
export interface RtDocument extends RtNode {
  createTextNode(text: string): RtNode;
}

export class Evaluator {
  private table: FunctionTable;
  readonly namespaces: Readonly<Record<string, string>>;

  constructor(
    namespaces: Readonly<Record<string, string>>,
    private readonly document: (name: string) => unknown,
    now: string,
    private readonly report: (issue: Issue) => void = () => undefined,
  ) {
    const ns: Record<string, string> = { ...NS };
    for (const [p, uri] of Object.entries(namespaces)) if (p !== '' && !(p in NS)) ns[p] = uri;
    this.namespaces = ns;
    this.table = runtimeFunctions({ now });
  }

  /** The time `Today` and `Now` read (R3.3). */
  setNow(now: string): void {
    this.table = runtimeFunctions({ now });
  }

  value(expr: string, node: unknown): XPathOut {
    try {
      return evaluateXPath(expr, {
        node,
        namespaces: this.namespaces,
        functions: this.table,
        document: this.document,
        report: this.report,
        unknownFunction: (name) => {
          throw new UnknownFunction(name);
        },
      });
    } catch (e) {
      if (e instanceof UnknownFunction)
        throw new NotEvaluated(expr, `${e.message} is not available in the viewer`);
      throw new NotEvaluated(expr, e instanceof Error ? e.message : String(e));
    }
  }

  string(expr: string, node: unknown): string {
    const v = this.value(expr, node);
    if (v.kind === 'nodes') return v.nodes.length ? textOf(v.nodes[0] as RtNode) : '';
    if (v.kind === 'number') return numberText(v.value);
    return String(v.value);
  }

  boolean(expr: string, node: unknown): boolean {
    const v = this.value(expr, node);
    if (v.kind === 'nodes') return v.nodes.length > 0;
    if (v.kind === 'number') return v.value !== 0 && !Number.isNaN(v.value);
    if (v.kind === 'string') return v.value !== '';
    return v.value;
  }

  nodes(expr: string, node: unknown): RtNode[] {
    const v = this.value(expr, node);
    if (v.kind !== 'nodes') throw new NotEvaluated(expr, 'does not select nodes');
    return v.nodes as RtNode[];
  }
}

/** XPath 1.0 string value of a node. */
export function textOf(n: RtNode): string {
  if (n.nodeType === 2) return n.value ?? '';
  return n.textContent ?? '';
}

/** XPath 1.0 number-to-string, as the `xpath` package writes it (design D7). */
export function numberText(n: number): string {
  if (Number.isNaN(n)) return 'NaN';
  if (n === Infinity) return 'Infinity';
  if (n === -Infinity) return '-Infinity';
  if (Object.is(n, -0)) return '0';
  const s = String(n);
  if (!/e/i.test(s)) return s;
  // XPath has no exponent: write the digits out.
  if (Math.abs(n) >= 1e21) return BigInt(n).toString();
  return n.toFixed(Math.min(100, -Math.floor(Math.log10(Math.abs(n))) + 15)).replace(/\.?0+$/, '');
}
