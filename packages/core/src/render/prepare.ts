// prepareView (spec 03 design §1, §3.1, §4): finds the view (R1.2, R1.3), parses its XSL through
// the xml/ layer and compiles it once. Asynchronous only because xsltjs loads xsl:import and
// xsl:include modules through an async loader; everything after this is synchronous (R1.4).

import { AfterlifeError, type Issue } from '../errors';
import type { FormIR, IrView } from '../ir/types';
import { resolveLimits, type Limits } from '../limits';
import { parseXmlDom, xmlContext } from '../xml/parse';
import type { ParsedTemplate } from '../xsn/parse';
import type { BoundControl } from '../ir/types';
import { compileView, type CompiledView } from './engine/xsltjs';
import {
  activeXIndex,
  controlIndex,
  requiredTargets,
  structureIndex,
  type StructureIndex,
} from './marks';

const MiB = 1024 * 1024;

export interface PrepareOptions {
  /** A FormIR view name; absent: the default view (R1.2). */
  readonly view?: string;
  readonly limits?: Partial<Pick<Limits, 'xmlDepth'>>;
  /** The XML budget for the view XSL and its included modules; 4 MiB as spec 02. */
  readonly viewXmlBytes?: number;
}

/** A view ready to render. Opaque apart from these fields. */
export interface PreparedView {
  readonly view: IrView;
  /** `EXTERNAL_RESOURCE_BLOCKED` for imports and includes, repeated in every render. */
  readonly issues: readonly Issue[];
}

/** @internal What renderView needs, kept out of the public object. */
export interface PreparedInternals {
  readonly template: ParsedTemplate;
  readonly ir: FormIR;
  readonly compiled: CompiledView;
  readonly file: (name: string) => Uint8Array | undefined;
  /** Design §9.1: the view's controls by XSL source position. */
  readonly controlAt: (file: string, line: number, column: number) => BoundControl | undefined;
  /** Design §9.2: fields that are required or the target of a blank check. */
  readonly required: ReadonlySet<string>;
  /** R6.2: the FormIR ActiveX control id at an XSL element position. */
  readonly activeXAt: (file: string, line: number, column: number) => string | undefined;
  /** Spec 04 task 8: groups with `IrGroup.insert`, by item path and by `xmlToEdit` name. */
  readonly structure: StructureIndex;
}

const internals = new WeakMap<PreparedView, PreparedInternals>();

/** @internal */
export function preparedInternals(prepared: PreparedView): PreparedInternals {
  const found = internals.get(prepared);
  if (!found) {
    throw new AfterlifeError('INTERNAL', {
      path: 'renderView',
      reason: 'not a PreparedView from prepareView',
    });
  }
  return found;
}

/** A package file by name, compared ignoring case (spec 01 R6.2). */
export function packageFiles(t: ParsedTemplate): (name: string) => Uint8Array | undefined {
  const byName = new Map<string, Uint8Array>();
  for (const f of t.files) {
    const key = f.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, f.bytes);
  }
  return (name) => byName.get(name.toLowerCase());
}

export async function prepareView(
  template: ParsedTemplate,
  ir: FormIR,
  options: PrepareOptions = {},
): Promise<PreparedView> {
  const view = findView(ir, options.view);
  const file = packageFiles(template);
  const bytes = view.xslFile === undefined ? undefined : file(view.xslFile);
  if (view.xslFile === undefined || bytes === undefined) {
    throw new AfterlifeError('VIEW_NOT_RENDERABLE', { view: view.name, reason: 'missing' });
  }
  if (!view.scanned) {
    throw new AfterlifeError('VIEW_NOT_RENDERABLE', { view: view.name, reason: 'unparsed' });
  }

  const limits = resolveLimits({
    xmlBytes: options.viewXmlBytes ?? 4 * MiB,
    ...(options.limits?.xmlDepth === undefined ? {} : { xmlDepth: options.limits.xmlDepth }),
  });
  const xml = xmlContext(limits);
  const { doc } = parseXmlDom(bytes, view.xslFile, xml);
  const compiled = await compileView({ view: view.name, xslFile: view.xslFile, doc, file, xml });

  const prepared: PreparedView = Object.freeze({
    view,
    issues: Object.freeze([...compiled.issues]),
  });
  internals.set(prepared, {
    template,
    ir,
    compiled,
    file,
    controlAt: controlIndex(view),
    required: requiredTargets(ir),
    activeXAt: activeXIndex(ir),
    structure: structureIndex(ir, template.manifest.namespaces),
  });
  return prepared;
}

/** R1.2: the named view, or the FormIR default view, or the first view. */
function findView(ir: FormIR, name: string | undefined): IrView {
  const view =
    name === undefined
      ? (ir.views.find((v) => v.isDefault) ?? ir.views[0])
      : ir.views.find((v) => v.name === name);
  if (!view)
    throw new AfterlifeError('VIEW_NOT_RENDERABLE', { view: name ?? '', reason: 'unknown' });
  return view;
}
