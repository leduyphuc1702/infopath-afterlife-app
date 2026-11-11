// The engine adapter (spec 03 design §5): the only module that imports xsltjs or xpath (lint).
// It compiles a view with loaders that read package files only (§5.1), runs it on a Processor of
// its own with per-instance hooks (§5.3), and returns the result tree. Nothing here reads a
// clock, the file system or the network; `fs` and `path` are stubbed in browser builds (§5.2).

import xpathModule from 'xpath';
import xsltjsModule from 'xsltjs';
import processorModule from 'xsltjs/scripts/Processor.js';
import serializerModule from 'xsltjs/scripts/Serializer.js';
import { AfterlifeError, type Issue } from '../../errors';
import type { BoundControl } from '../../ir/types';
import {
  emptyDocument,
  scratchDocument,
  xmlText,
  type DomDocument,
  type XmlContext,
} from '../../xml/parse';
import type { Budget } from './budget';
import {
  CORE_FUNCTIONS,
  STRING_FUNCTIONS,
  functionName,
  type FnArg,
  type FnHost,
  type FnNode,
  type FnNodeSet,
  type FnValue,
  type FunctionTable,
} from './host';

// --- The parts of xsltjs and xpath we use, typed (design §5.3 lists each one) -----------------

interface XValue {
  stringValue(): string;
  numberValue(): number;
}
interface XExpr {
  evaluate(c: unknown): XValue;
}
type XFn = (c: unknown, ...args: XExpr[]) => XValue;

const BUDGET: unique symbol = Symbol('afterlife.budget');
/** Marks our `applyStep` wrapper, across module instances (a re-import, Vite HMR). */
const MARK: unique symbol = Symbol.for('afterlife.applyStep');
const ORIGINAL: unique symbol = Symbol.for('afterlife.applyStep.original');

interface XPathContextLike {
  readonly xslt?: { readonly processor?: { readonly [BUDGET]?: Budget } };
}
type ApplyStep = ((
  this: unknown,
  step: unknown,
  xpc: XPathContextLike | undefined,
  node: unknown,
) => unknown[]) & { [MARK]?: true; [ORIGINAL]?: ApplyStep };

interface XPathInternals {
  readonly XNodeSet: new () => {
    first(): unknown;
    toArray(): unknown[];
    addArray(nodes: readonly unknown[]): void;
  };
  readonly XString: new (s: string) => XValue;
  readonly XNumber: new (n: number) => XValue;
  readonly XBoolean: new (b: boolean) => XValue;
  readonly PathExpr: { applyStep: ApplyStep };
  /** Spec 04 D5: an expression compiled on its own, outside a stylesheet. */
  readonly parse: (expr: string) => { evaluate(options: object): XValue };
}

interface FunctionsLike {
  find(local: string, ns: string): XFn | undefined;
  isAvailable(local: string, ns: string): boolean;
}

/** An @xmldom/xmldom `DocumentFragment`: the result tree. */
export interface DomFragment {
  readonly nodeType: 11;
}

/** The XSL element a literal result element comes from: xmldom, with its source position. */
interface XslElement {
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly ownerDocument?: { readonly xsltBaseURI?: string };
  getAttributeNS(ns: string, local: string): string | null;
}

/** A node added to or copied into a result tree. */
interface ResultNodeLike {
  readonly nodeType: number;
  readonly data?: string;
  readonly attributes?: ArrayLike<{ readonly name: string; readonly value: string }>;
}

interface LiteralCtx {
  readonly out?: { readonly lastChild: object | null } | null;
  /** The current node. */
  readonly node?: unknown;
}

interface ProcessorLike {
  readonly functions: FunctionsLike;
  transform(source: unknown): DomFragment;
  literalResultElement(element: XslElement, ctx: LiteralCtx): void;
  evaluate(text: string, ctx: LiteralCtx, styleNode: XslElement): unknown;
  invokeTemplate: (this: ProcessorLike, a: unknown, b: unknown, c: unknown, d: unknown) => void;
  builtInRule: (this: ProcessorLike, a: unknown, b: unknown, c: unknown, d: unknown) => void;
  executeInstruction: (this: ProcessorLike, a: unknown, b: unknown) => unknown;
  appendText(out: unknown, text: unknown, raw?: boolean): void;
  appendNode(out: unknown, node: ResultNodeLike): void;
  setAttribute(
    out: { nodeType?: number } | null,
    ns: unknown,
    qname: string,
    value: string,
    styleNode: unknown,
  ): void;
  copyNode(node: ResultNodeLike, out: unknown, deep: boolean): void;
  [BUDGET]?: Budget;
}

interface StylesheetLike {
  readonly output: Record<string, unknown>;
  readonly cdataSectionElements: unknown;
}

interface XsltErrorLike extends Error {
  readonly code: string;
  readonly location: string;
  readonly cause?: unknown;
}

interface Logger {
  warn(text: string): void;
  debug(): void;
  log(): void;
  info(): void;
  error(): void;
}

export const XPath = xpathModule as unknown as XPathInternals;
const XSLT = xsltjsModule.XSLT as {
  compile(doc: unknown, options: object): Promise<StylesheetLike>;
};
const Processor = processorModule.Processor as {
  new (
    stylesheet: StylesheetLike,
    options: {
      documentLoader: (uri: string) => DomDocument | null;
      logger: Logger;
      onMessage: (text: string, terminate: boolean) => void;
    },
  ): ProcessorLike;
};
const Serializer = serializerModule.Serializer as new (
  output: Record<string, unknown>,
  cdata: unknown,
) => { serialize(fragment: DomFragment): string };

// --- XPath location steps charge the render's budget (D9, design §5.3) -------------------------

installApplyStep();

function installApplyStep(): void {
  const pathExpr = XPath.PathExpr;
  if (applyStepWrappers() > 0) return;
  const original = pathExpr.applyStep;
  const wrapped: ApplyStep = function (
    this: unknown,
    step: unknown,
    xpc: XPathContextLike | undefined,
    node: unknown,
  ) {
    const nodes = original.call(this, step, xpc, node);
    xpc?.xslt?.processor?.[BUDGET]?.chargeStep(nodes.length);
    return nodes;
  };
  wrapped[MARK] = true;
  wrapped[ORIGINAL] = original;
  pathExpr.applyStep = wrapped;
}

/** How many of our wrappers are on `PathExpr.applyStep` (the guard test expects 1). */
export function applyStepWrappers(): number {
  let count = 0;
  for (let f: ApplyStep | undefined = XPath.PathExpr.applyStep; f; f = f[ORIGINAL]) {
    if (f[MARK]) count++;
  }
  return count;
}

// --- Compile (design §5.1) -------------------------------------------------------------------

/** What a blocked `xsl:import` or `xsl:include` loads instead: a module with no declarations. */
export const EMPTY_XSL =
  '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>';

const BASE = 'xsn:///';
const XD = 'http://schemas.microsoft.com/office/infopath/2003';

export interface CompileInput {
  /** The view name, for error messages. */
  readonly view: string;
  /** The package file name of the view XSL. */
  readonly xslFile: string;
  /** The view XSL, parsed by `parseXmlDom`. Compiling changes it. */
  readonly doc: DomDocument;
  /** A package file by name, compared ignoring case (spec 01 R6.2), or undefined. */
  readonly file: (name: string) => Uint8Array | undefined;
  /** The XML budget included modules are charged to. */
  readonly xml: XmlContext;
}

export class CompiledView {
  /** @internal */
  constructor(
    readonly view: string,
    readonly xslFile: string,
    /** `EXTERNAL_RESOURCE_BLOCKED`, in the order the engine loaded modules. */
    readonly issues: readonly Issue[],
    /** @internal */
    readonly stylesheet: StylesheetLike,
  ) {}
}

export async function compileView(input: CompileInput): Promise<CompiledView> {
  const issues: Issue[] = [];
  let abort: unknown;
  const loader = (uri: string): Promise<string> => {
    const name = packageName(uri);
    const bytes = name === undefined ? undefined : input.file(name);
    if (name === undefined || bytes === undefined) {
      issues.push(blocked(input.xslFile, uri));
      return Promise.resolve(EMPTY_XSL);
    }
    try {
      return Promise.resolve(xmlText(bytes, name, input.xml).text);
    } catch (e) {
      // xsltjs replaces a loader error with its own; keep ours (design §5.3, Errors).
      abort ??= e;
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  };
  try {
    const stylesheet = await XSLT.compile(input.doc, {
      transformURL: BASE + encodeURIComponent(input.xslFile),
      loader,
    });
    return new CompiledView(input.view, input.xslFile, issues, stylesheet);
  } catch (e) {
    throw toAfterlifeError(abort ?? e, input.view);
  }
}

// --- Run (design §5.3, §7.2) -----------------------------------------------------------------

export interface RunOptions {
  /** Test-only (R10.1): every extension function unavailable, as in `xsltproc`. */
  readonly fallback?: boolean;
  /** Extension functions by namespace; ignored in fallback mode. */
  readonly functions: FunctionTable;
  /** Where the bindings' issues go; the adapter builds the rest of each call's FnHost. */
  readonly host: Pick<FnHost, 'report'>;
  /** A package XML file for `document()`, by name, or undefined. */
  readonly loadDocument: (name: string) => DomDocument | undefined;
  readonly budget: Budget;
  /** Base URI of the source document, for relative `document()` calls. */
  readonly sourceFile?: string;
  /** Design §9.1: the FormIR control at an XSL element position (package file, line, column). */
  /** Spec 04 task 8: whether a record node is an item of a group with `IrGroup.insert`. */
  readonly isItem?: (node: unknown) => boolean;
  readonly controlAt?: (file: string, line: number, column: number) => BoundControl | undefined;
}

/**
 * Spec 04 task 8 (D20): a result element that draws a group item (the outermost element created
 * with the item as current node) or an `xd:action` insert placeholder (with its `xd:xmlToEdit`).
 */
export interface StructureElement {
  readonly node: unknown;
  readonly insert?: string;
}

/** A rendered control: its FormIR control, and the source node its binding selected. */
export interface MarkedElement {
  readonly control: BoundControl;
  /** An @xmldom/xmldom node of the record; absent when the binding was not or could not be evaluated. */
  readonly node?: unknown;
}

export interface RunResult {
  readonly fragment: DomFragment;
  /** In first-occurrence order: blocked documents, unknown functions, warnings, messages. */
  readonly issues: readonly Issue[];
  /** Result-tree element → its control (design §9.1). Empty without `controlAt`. */
  readonly marked: ReadonlyMap<object, MarkedElement>;
  /** Literal elements with an `xd:binding` at a position FormIR did not record. */
  readonly unmarked: number;
  /** Spec 04 task 8: result element → the item or insert placeholder it draws. */
  readonly structure: ReadonlyMap<object, StructureElement>;
}

export function runView(view: CompiledView, source: DomDocument, options: RunOptions): RunResult {
  const blockedDocs: Issue[] = [];
  const unknown = new Map<string, number>();
  const warnings = new Map<string, { count: number; first: string }>();
  let messages = 0;
  let abort: unknown;

  const documentLoader = (uri: string): DomDocument | null => {
    const name = packageName(uri);
    let doc: DomDocument | undefined;
    try {
      doc = name === undefined ? undefined : options.loadDocument(name);
    } catch (e) {
      // xsltjs turns a loader error into a warning; a limit or unsafe file must stop the render.
      abort ??= e;
      throw e;
    }
    if (doc === undefined) {
      blockedDocs.push(blocked(view.xslFile, uri));
      return null;
    }
    return doc;
  };
  const logger: Logger = {
    warn(text) {
      const code = /^([A-Z]{4}\d{4})/.exec(text)?.[1] ?? 'warning';
      const seen = warnings.get(code);
      if (seen) seen.count++;
      else warnings.set(code, { count: 1, first: text });
    },
    debug() {},
    log() {},
    info() {},
    error() {},
  };
  const p = new Processor(view.stylesheet, {
    documentLoader,
    logger,
    onMessage: () => {
      messages++;
    },
  });
  p[BUDGET] = options.budget;
  installBudget(p, options.budget);
  installFunctions(p.functions, options, unknown);
  const marked = new Map<object, MarkedElement>();
  const structure = new Map<object, StructureElement>();
  const itemElement = new Map<unknown, object>();
  let unmarked = 0;
  if (options.controlAt) {
    const controlAt = options.controlAt;
    const isItem = options.isItem;
    const proto = Object.getPrototypeOf(p) as ProcessorLike;
    p.literalResultElement = (element, ctx) => {
      proto.literalResultElement.call(p, element, ctx);
      const created = ctx.out?.lastChild;
      if (created && isItem) {
        // Children finish first, so the last element seen for an item is its outermost one.
        const action = element.getAttributeNS(XD, 'action');
        const name = element.getAttributeNS(XD, 'xmlToEdit');
        if ((action === 'xCollection::insert' || action === 'xOptional::insert') && name) {
          structure.set(created, { node: ctx.node, insert: name });
        } else if (ctx.node !== undefined && isItem(ctx.node)) {
          const before = itemElement.get(ctx.node);
          if (before) structure.delete(before);
          itemElement.set(ctx.node, created);
          structure.set(created, { node: ctx.node });
        }
      }
      const file = packageName(element.ownerDocument?.xsltBaseURI ?? '');
      const control =
        file === undefined
          ? undefined
          : controlAt(file, element.lineNumber ?? 0, element.columnNumber ?? 0);
      if (!control) {
        if (element.getAttributeNS(XD, 'binding') !== null) unmarked++;
        return;
      }
      if (!created) return;
      let node: unknown;
      if (control.targetId !== undefined && !control.readOnly) {
        try {
          const value = proto.evaluate.call(p, control.binding, ctx, element);
          if (value instanceof XPath.XNodeSet) node = value.first() ?? undefined;
        } catch (e) {
          // FormIR already reported a bad binding; a limit or our own error still stops the run.
          if (
            e instanceof AfterlifeError ||
            (e as { cause?: unknown }).cause instanceof AfterlifeError
          ) {
            throw e;
          }
        }
      }
      marked.set(created, node === undefined ? { control } : { control, node });
    };
  }

  const doc = source as unknown as { xsltBaseURI?: string };
  if (doc.xsltBaseURI === undefined) doc.xsltBaseURI = BASE + (options.sourceFile ?? 'record.xml');
  let fragment: DomFragment;
  try {
    fragment = p.transform(source);
  } catch (e) {
    const b = options.budget;
    throw toAfterlifeError(
      b.abort ?? abort ?? (isStackOverflow(e) ? b.stackOverflow() : e),
      view.view,
    );
  }
  const stored = options.budget.abort ?? abort;
  if (stored !== undefined) throw toAfterlifeError(stored, view.view);

  const issues: Issue[] = [...blockedDocs];
  for (const [name, calls] of unknown) {
    issues.push({
      code: 'UNKNOWN_FUNCTION',
      message: `${view.xslFile}: ${name} is not implemented; ${calls} call(s) gave ''`,
      file: view.xslFile,
      details: { name, calls },
    });
  }
  for (const [code, { count, first }] of warnings) {
    issues.push({
      code: 'ENGINE_WARNING',
      message: `${view.xslFile}: ${first}${count > 1 ? ` (${count} times)` : ''}`,
      file: view.xslFile,
      details: { code, count },
    });
  }
  if (messages > 0) {
    issues.push({
      code: 'XSL_MESSAGE',
      message: `${view.xslFile}: xsl:message ran ${messages} time(s)`,
      file: view.xslFile,
      details: { count: messages },
    });
  }
  return { fragment, issues, marked, unmarked, structure };
}

/**
 * Design §5.3 and §6: depth on template and built-in rule calls, one step per instruction, and
 * output bytes on every write to a result tree, the main one or a variable's. Each hook is an
 * own property of this processor, so no other render is charged.
 */
function installBudget(p: ProcessorLike, budget: Budget): void {
  const proto = Object.getPrototypeOf(p) as ProcessorLike;
  // Each frame here is repeated at every nesting level, and a Worker's stack is smaller than
  // Node's (design §6, §12): fixed arity, no closures per call.
  const invoke = proto.invokeTemplate;
  const builtIn = proto.builtInRule;
  const execute = proto.executeInstruction;
  p.invokeTemplate = function (a, b, c, d) {
    budget.enter();
    try {
      invoke.call(p, a, b, c, d);
    } finally {
      budget.depth--;
    }
  };
  p.builtInRule = function (a, b, c, d) {
    budget.enter();
    try {
      builtIn.call(p, a, b, c, d);
    } finally {
      budget.depth--;
    }
  };
  p.executeInstruction = function (a, b) {
    budget.step();
    return execute.call(p, a, b);
  };
  p.appendText = (out, text, raw) => {
    if (out && typeof text === 'string') budget.chargeOutput(text.length);
    proto.appendText.call(p, out, text, raw);
  };
  p.appendNode = (out, node) => {
    if (out)
      budget.chargeOutput(
        node.nodeType === 7 || node.nodeType === 8 ? (node.data ?? '').length : 0,
        1,
      );
    proto.appendNode.call(p, out, node);
  };
  p.setAttribute = (out, ns, qname, value, styleNode) => {
    if (out && out.nodeType === 1) budget.chargeOutput(qname.length + value.length);
    proto.setAttribute.call(p, out, ns, qname, value, styleNode);
  };
  p.copyNode = (node, out, deep) => {
    // A deep-copied element's attributes bypass setAttribute; its node and children do not.
    if (deep && node.nodeType === 1 && node.attributes) {
      let chars = 0;
      for (let i = 0; i < node.attributes.length; i++) {
        const a = node.attributes[i]!;
        chars += a.name.length + a.value.length;
      }
      budget.chargeOutput(chars);
    }
    proto.copyNode.call(p, node, out, deep);
  };
}

/** V8's stack overflow, directly or as the cause of an XsltError (design §5.3, Errors). */
function isStackOverflow(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && i < 4; x = (x as { cause?: unknown }).cause, i++) {
    if (x instanceof RangeError && x.message === 'Maximum call stack size exceeded') return true;
  }
  return false;
}

/** Test-only (design D10): the result tree as `xsltjs` itself would serialise it. */
export function engineHtml(view: CompiledView, fragment: DomFragment): string {
  const { output, cdataSectionElements } = view.stylesheet;
  return new Serializer({ ...output }, cdataSectionElements).serialize(fragment);
}

/**
 * `function-available` is true exactly for the allowed set (design §7.2). Any other function
 * returns '' and is counted. String results of string functions are charged to the budget (§6).
 */
function installFunctions(
  fns: FunctionsLike,
  options: RunOptions,
  unknown: Map<string, number>,
): void {
  const find = fns.find.bind(fns);
  const table: FunctionTable = options.fallback ? new Map() : options.functions;
  const budget = options.budget;
  const core = (local: string, ns: string) =>
    ns === '' && CORE_FUNCTIONS.has(local) && find(local, ns) !== undefined;
  let scratch: ScratchDoc | undefined;
  const scratchRoot = () =>
    (scratch ??= scratchDocument() as unknown as ScratchDoc).documentElement;

  /** The host one call sees: its calling context `c` gives Eval its namespaces (§7.1). */
  const hostFor = (c: XPathContextOf): FnHost => ({
    report: (issue) => options.host.report(issue),
    makeNodes: (values) => {
      const root = scratchRoot();
      const doc = root.ownerDocument;
      const set = doc.createElement('set');
      root.appendChild(set);
      const nodes = values.map((v) => {
        const el = doc.createElement('value');
        if (v !== '') el.appendChild(doc.createTextNode(v));
        set.appendChild(el);
        return el;
      });
      budget.chargeOutput(
        values.reduce((n, v) => n + v.length, 0),
        values.length + 1,
      );
      return new NodeSetValue(nodes);
    },
    document: (file) => {
      const doc = options.loadDocument(file);
      return doc === undefined ? undefined : new NodeSetValue([doc]);
    },
    emptyDocument: () => new NodeSetValue([emptyDocument()]),
    evaluate: (expr, node) => {
      const x = c.xslt;
      if (!x || !(node instanceof EngineNode)) return undefined;
      const ctx = { ...x.ctx, node: node.node, position: 1, size: 1 };
      try {
        return (x.processor.evaluate(expr, ctx, x.styleNode) as XValue).stringValue();
      } catch (e) {
        if (budget.abort) throw budget.abort;
        if (e instanceof AfterlifeError) throw e;
        if ((e as { cause?: unknown } | undefined)?.cause instanceof AfterlifeError) throw e;
        return undefined;
      }
    },
    nested: (fn) => {
      budget.enter();
      try {
        return fn();
      } finally {
        budget.depth--;
      }
    },
    chargeOutput: (chars) => budget.chargeOutput(chars),
  });

  fns.isAvailable = (local, ns) => core(local, ns) || table.get(ns)?.has(local) === true;
  fns.find = (local, ns) => {
    if (core(local, ns)) {
      const f = find(local, ns)!;
      if (!STRING_FUNCTIONS.has(local)) return f;
      return (c, ...args) => {
        const result = f(c, ...args);
        budget.chargeString(result.stringValue().length);
        return result;
      };
    }
    const impl = table.get(ns)?.get(local);
    if (impl) {
      return (c, ...exprs) => {
        const value = impl(
          exprs.map((e) => lazyArg(c, e)),
          hostFor(c as XPathContextOf),
        );
        // formatString and the other string-valued extensions are charged like concat (§6).
        if (typeof value === 'string') budget.chargeString(value.length);
        return toXValue(value);
      };
    }
    const name = functionName(local, ns);
    return () => {
      unknown.set(name, (unknown.get(name) ?? 0) + 1);
      return new XPath.XString('');
    };
  };
}

/** The XPath context xsltjs passes to a function: who called it, and where (makeXPathContext). */
interface XPathContextOf {
  readonly xslt?: {
    readonly processor: ProcessorLike;
    readonly ctx: object;
    readonly styleNode: XslElement;
  };
}

interface ScratchDoc {
  readonly documentElement: ScratchElement;
}
interface ScratchElement {
  readonly ownerDocument: {
    createElement(name: string): ScratchElement;
    createTextNode(text: string): unknown;
  };
  appendChild(node: unknown): unknown;
}

/** A node handed to a binding: the engine node stays inside. */
class EngineNode implements FnNode {
  constructor(readonly node: DomNodeLike) {}
  get element(): boolean {
    return this.node.nodeType === 1;
  }
  string(): string {
    return stringValue(this.node);
  }
}

/** A node-set a binding returns: the engine nodes, in document order. */
class NodeSetValue implements FnNodeSet {
  readonly kind = 'nodes';
  constructor(readonly nodes: readonly unknown[]) {}
}

interface DomNodeLike {
  readonly nodeType: number;
  readonly data?: string;
  readonly value?: string;
  readonly textContent?: string | null;
}

/** XPath 1.0 string value of a node. */
function stringValue(n: DomNodeLike): string {
  if (n.nodeType === 2) return n.value ?? '';
  if (n.nodeType === 3 || n.nodeType === 4 || n.nodeType === 7 || n.nodeType === 8) {
    return n.data ?? '';
  }
  return n.textContent ?? '';
}

function lazyArg(c: unknown, expr: XExpr): FnArg {
  let value: XValue | undefined;
  const get = () => (value ??= expr.evaluate(c));
  const asNodes = () => {
    const v = get();
    return v instanceof XPath.XNodeSet ? (v.toArray() as DomNodeLike[]) : undefined;
  };
  return {
    string: () => get().stringValue(),
    number: () => get().numberValue(),
    nodes: () => asNodes()?.map((n) => new EngineNode(n)),
    nodeSet: () => {
      const nodes = asNodes();
      if (nodes) return new NodeSetValue(nodes);
      const doc = scratchDocument() as unknown as ScratchDoc;
      return new NodeSetValue([
        doc.documentElement.ownerDocument.createTextNode(get().stringValue()),
      ]);
    },
  };
}

function toXValue(v: FnValue): XValue {
  if (typeof v === 'string') return new XPath.XString(v);
  if (typeof v === 'number') return new XPath.XNumber(v);
  if (typeof v === 'boolean') return new XPath.XBoolean(v);
  const set = new XPath.XNodeSet();
  set.addArray(v instanceof NodeSetValue ? v.nodes : []);
  return set as unknown as XValue;
}

// --- Shared helpers ----------------------------------------------------------------------------

/** `xsn:///<name>` → `<name>`; anything else (another scheme, a folder, bad escapes) → undefined. */
function packageName(uri: string): string | undefined {
  if (!uri.startsWith(BASE)) return undefined;
  let name: string;
  try {
    name = decodeURIComponent(uri.slice(BASE.length).replace(/[?#].*$/, ''));
  } catch {
    return undefined;
  }
  return name === '' || /[\\/]/.test(name) ? undefined : name;
}

function blocked(file: string, uri: string): Issue {
  return {
    code: 'EXTERNAL_RESOURCE_BLOCKED',
    message: `${file}: ${uri} is not a package file; nothing was loaded`,
    file,
    details: { uri },
  };
}

/** Design §5.3, Errors: our own error first, then the engine's code and line. */
function toAfterlifeError(e: unknown, view: string): AfterlifeError {
  if (e instanceof AfterlifeError) return e as AfterlifeError;
  const cause = (e as { cause?: unknown } | undefined)?.cause;
  if (cause instanceof AfterlifeError) return cause as AfterlifeError;
  // Any RangeError other than a stack overflow (invalid string or array length), found
  // directly or as the cause of an XsltError, fails the render; it is never a crash.
  const range = e instanceof RangeError ? e : cause instanceof RangeError ? cause : undefined;
  if (range) {
    return new AfterlifeError('RENDER_FAILED', {
      view,
      xsltCode: 'RangeError',
      message: range.message,
    });
  }
  if (e instanceof Error && e.name === 'XsltError') {
    const x = e as XsltErrorLike;
    const line = /\bline (\d+)/.exec(x.location)?.[1];
    const body = x.message.startsWith(`${x.code}: `)
      ? x.message.slice(x.code.length + 2)
      : x.message;
    const suffix = x.location ? ` (${x.location})` : '';
    const message = suffix && body.endsWith(suffix) ? body.slice(0, -suffix.length) : body;
    return new AfterlifeError('RENDER_FAILED', {
      view,
      xsltCode: x.code,
      message,
      ...(line === undefined ? {} : { line: Number(line) }),
    });
  }
  const err = e instanceof Error ? e : new Error(String(e));
  return new AfterlifeError('RENDER_FAILED', { view, xsltCode: err.name, message: err.message });
}

// --- Spec 04 D5: XPath outside a stylesheet, for the Classic runtime -----------------------------

/** What an expression gave: nodes in document order, or an atomic value. */
export type XPathOut =
  | { readonly kind: 'nodes'; readonly nodes: readonly unknown[] }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean };

export interface XPathEvalOptions {
  /** The context node: an @xmldom/xmldom node of a document the caller owns. */
  readonly node: unknown;
  readonly namespaces: Readonly<Record<string, string>>;
  readonly functions: FunctionTable;
  /** GetDOM: a data source's document by name, or undefined. */
  readonly document: (name: string) => unknown;
  readonly report: (issue: Issue) => void;
  /** Called for a prefixed function the table does not hold; must throw. */
  readonly unknownFunction: (name: string) => never;
}

const COMPILED = new Map<string, { evaluate(options: object): XValue }>();

/** Spec 04 R3.1: `expr` against `options.node`, with the InfoPath functions of `functions`. */
export function evaluateXPath(expr: string, options: XPathEvalOptions): XPathOut {
  let parsed = COMPILED.get(expr);
  if (!parsed) {
    parsed = XPath.parse(expr);
    if (COMPILED.size >= 2000) COMPILED.clear();
    COMPILED.set(expr, parsed);
  }
  const host: FnHost = {
    report: options.report,
    makeNodes: (values) => {
      // In a document, so document order is defined (an orphan breaks the xpath package's sort).
      const root = (scratchDocument() as unknown as ScratchDoc).documentElement;
      const doc = root.ownerDocument;
      return new NodeSetValue(
        values.map((v) => {
          const el = doc.createElement('value');
          if (v !== '') el.appendChild(doc.createTextNode(v));
          root.appendChild(el);
          return el;
        }),
      );
    },
    document: (name) => {
      const doc = options.document(name);
      return doc === undefined ? undefined : new NodeSetValue([doc]);
    },
    emptyDocument: () => new NodeSetValue([emptyDocument()]),
    evaluate: (inner, node) => {
      if (!(node instanceof EngineNode)) return undefined;
      const out = evaluateXPath(inner, { ...options, node: node.node });
      return out.kind === 'nodes'
        ? out.nodes.length > 0
          ? stringValue(out.nodes[0] as DomNodeLike)
          : ''
        : String(out.value);
    },
    nested: (fn) => fn(),
    chargeOutput: () => undefined,
  };
  const functions = {
    getFunction: (local: string, ns: string | null) => {
      if (ns === null || ns === '') return undefined;
      const impl = options.functions.get(ns)?.get(local);
      if (!impl) return () => options.unknownFunction(functionName(local, ns));
      return (_c: unknown, ...values: XValue[]) => toXValue(impl(values.map(valueArg), host));
    },
  };
  const v = parsed.evaluate({ node: options.node, namespaces: options.namespaces, functions });
  const out: unknown = v;
  if (out instanceof XPath.XNodeSet) return { kind: 'nodes', nodes: out.toArray() };
  if (out instanceof XPath.XNumber) return { kind: 'number', value: v.numberValue() };
  if (out instanceof XPath.XBoolean) return { kind: 'boolean', value: v.stringValue() === 'true' };
  return { kind: 'string', value: v.stringValue() };
}

/** An argument the `xpath` package has already evaluated, as a binding sees it. */
function valueArg(v: XValue): FnArg {
  const nodes = () => (v instanceof XPath.XNodeSet ? (v.toArray() as DomNodeLike[]) : undefined);
  return {
    string: () => v.stringValue(),
    number: () => v.numberValue(),
    nodes: () => nodes()?.map((n) => new EngineNode(n)),
    nodeSet: () => {
      const n = nodes();
      if (n) return new NodeSetValue(n);
      const doc = scratchDocument() as unknown as ScratchDoc;
      return new NodeSetValue([doc.documentElement.ownerDocument.createTextNode(v.stringValue())]);
    },
  };
}
