// Drives the engine adapter directly (spec 03 tasks 1–2): compile a view, run it, serialise the
// result the way xsltjs does.

import { resolveLimits, resolveRenderLimits, type RenderLimits } from '../../src/limits';
import { Budget } from '../../src/render/engine/budget';
import type { FunctionTable } from '../../src/render/engine/host';
import {
  compileView,
  engineHtml,
  runView,
  type CompiledView,
  type RunOptions,
} from '../../src/render/engine/xsltjs';
import type { Issue } from '../../src/errors';
import { postProcess } from '../../src/render/render';
import { parseXmlDom, xmlContext, type DomDocument } from '../../src/xml/parse';
import type { ViewCase } from './render-cases';
import { packageFileOf } from './render-cases';

const enc = new TextEncoder();
const MiB = 1024 * 1024;
const ctx = () => xmlContext(resolveLimits({ xmlBytes: 16 * MiB }));

export const dom = (bytes: Uint8Array | string, file = 'doc.xml'): DomDocument =>
  parseXmlDom(typeof bytes === 'string' ? enc.encode(bytes) : bytes, file, ctx()).doc;

/** Compiles `xsl`; `files` are the other package files, by name. */
export function compileText(
  xsl: string,
  files: Readonly<Record<string, string>> = {},
  xslFile = 'view1.xsl',
): Promise<CompiledView> {
  const byName = new Map(Object.entries(files).map(([k, v]) => [k.toLowerCase(), enc.encode(v)]));
  return compileView({
    view: 'View 1',
    xslFile,
    doc: dom(xsl, xslFile),
    file: (name) => byName.get(name.toLowerCase()),
    xml: ctx(),
  });
}

export function compileCase(c: ViewCase): Promise<CompiledView> {
  const file = packageFileOf(c.t);
  return compileView({
    view: c.view,
    xslFile: c.xslFile,
    doc: dom(file(c.xslFile)!, c.xslFile),
    file,
    xml: ctx(),
  });
}

export interface RunOutput {
  readonly html: string;
  readonly marked: number;
  readonly issues: readonly Issue[];
  readonly budget: Budget;
}

export function runCompiled(
  view: CompiledView,
  record: Uint8Array | string,
  options: {
    fallback?: boolean;
    functions?: FunctionTable;
    documents?: Readonly<Record<string, string>>;
    controlAt?: RunOptions['controlAt'];
    limits?: Partial<RenderLimits>;
  } = {},
): RunOutput {
  const budget = new Budget(resolveRenderLimits(options.limits));
  const reported: Issue[] = [];
  const { fragment, issues, marked } = runView(view, dom(record, 'record.xml'), {
    ...(options.controlAt ? { controlAt: options.controlAt } : {}),
    fallback: options.fallback ?? false,
    functions: options.functions ?? new Map(),
    host: { report: (i) => reported.push(i) },
    loadDocument: (name) => {
      const text = options.documents?.[name];
      return text === undefined ? undefined : dom(text, name);
    },
    budget,
  });
  return {
    html: engineHtml(view, fragment),
    marked: marked.size,
    issues: [...issues, ...reported],
    budget,
  };
}

/** Compiles and runs `xsl`, then post-processes the result as renderView does (design §8.1). */
export async function postText(
  xsl: string,
  record: string = '<r/>',
  scope = 's1',
): Promise<{ html: string; css: string; issues: Issue[] }> {
  const view = await compileText(xsl);
  const { fragment } = runView(view, dom(record, 'record.xml'), {
    functions: new Map(),
    host: { report() {} },
    loadDocument: () => undefined,
    budget: new Budget(),
  });
  return postProcess(fragment, scope, 'view1.xsl');
}
