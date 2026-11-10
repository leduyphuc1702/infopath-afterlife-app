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
import { xmlText, type DomDocument, type XmlContext } from '../../xml/parse';
import type { Budget } from './budget';
import {
  CORE_FUNCTIONS,
  STRING_FUNCTIONS,
  functionName,
  type FnArg,
  type FnHost,
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
  readonly XNodeSet: new () => { first(): unknown };
  readonly XString: new (s: string) => XValue;
  readonly XNumber: new (n: number) => XValue;
  readonly XBoolean: new (b: boolean) => XValue;
  readonly PathExpr: { applyStep: ApplyStep };
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

interface LiteralCtx {
  readonly out?: { readonly lastChild: object | null } | null;
}

interface ProcessorLike {
  readonly functions: FunctionsLike;
  transform(source: unknown): DomFragment;
  literalResultElement(element: XslElement, ctx: LiteralCtx): void;
  evaluate(text: string, ctx: LiteralCtx, styleNode: XslElement): unknown;
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
  readonly host: FnHost;
  /** A package XML file for `document()`, by name, or undefined. */
  readonly loadDocument: (name: string) => DomDocument | undefined;
  readonly budget: Budget;
  /** Base URI of the source document, for relative `document()` calls. */
  readonly sourceFile?: string;
  /** Design §9.1: the FormIR control at an XSL element position (package file, line, column). */
  readonly controlAt?: (file: string, line: number, column: number) => BoundControl | undefined;
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
  installFunctions(p.functions, options, unknown);
  const marked = new Map<object, MarkedElement>();
  let unmarked = 0;
  if (options.controlAt) {
    const controlAt = options.controlAt;
    const proto = Object.getPrototypeOf(p) as ProcessorLike;
    p.literalResultElement = (element, ctx) => {
      proto.literalResultElement.call(p, element, ctx);
      const created = ctx.out?.lastChild;
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
    throw toAfterlifeError(abort ?? e, view.view);
  }
  if (abort !== undefined) throw toAfterlifeError(abort, view.view);

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
  return { fragment, issues, marked, unmarked };
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
          options.host,
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

function lazyArg(c: unknown, expr: XExpr): FnArg {
  let value: XValue | undefined;
  const get = () => (value ??= expr.evaluate(c));
  return { string: () => get().stringValue(), number: () => get().numberValue() };
}

function toXValue(v: FnValue): XValue {
  if (typeof v === 'string') return new XPath.XString(v);
  if (typeof v === 'number') return new XPath.XNumber(v);
  return new XPath.XBoolean(v);
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
