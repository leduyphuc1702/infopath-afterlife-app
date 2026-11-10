// renderView (spec 03 design §1, §3.1, §4): synchronous and pure (R1.4). Checks the inputs,
// parses the record as hostile input (R1.5), notes a record made with another template version
// (R2.1), runs the prepared view, and post-processes the result tree without a DOM (§8): sanitise,
// mark controls (§9), make inert, serialise, and scope the view's CSS to the render root.

import { AfterlifeError, type Issue } from '../errors';
import { resolveLimits, type Limits, type RenderLimits } from '../limits';
import { parseXmlDom, xmlContext, type DomDocument } from '../xml/parse';
import { solutionAttribute } from '../xsn/package';
import { Budget } from './engine/budget';
import { runView, type DomFragment, type MarkedElement } from './engine/xsltjs';
import { functionTable } from './functions';
import { scopeCss, scopeId, type Removed } from './html/css';
import { OWN_CSS } from './html/own-css';
import { REMOVED_KINDS, sanitiseResult, type ResultNode } from './html/sanitise';
import { serialiseHtml } from './html/serialise';
import { applyMarks, controlMark } from './marks';
import { preparedInternals, type PreparedView } from './prepare';

export interface RenderInput {
  /** Record bytes; absent: the template's `initialXmlDocument` file (R1.2). */
  readonly record?: Uint8Array;
  /** Required ISO 8601 date-time with offset, e.g. `2026-11-10T21:24:10+07:00` (R1.4). */
  readonly now: string;
  /** BCP 47; default `en-US`. */
  readonly locale?: string;
  /** Default ''. */
  readonly userName?: string;
  readonly limits?: Partial<RenderLimits & Pick<Limits, 'xmlDepth' | 'xmlBytes'>>;
}

export interface ControlMark {
  /** FormIR `BoundControl.id`. */
  readonly controlId: string;
  /** With positions; absent for an ExpressionBox or a binding that selects nothing. */
  readonly path?: string;
  readonly fieldId?: string;
  readonly empty: boolean;
  /** R6.6: the asterisk was drawn. */
  readonly required: boolean;
}

export interface RenderResult {
  /** `<div class="afl-root" data-afl-scope="s…" inert>…</div>`. */
  readonly html: string;
  /** View rules scoped to the root, then our own rules. */
  readonly css: string;
  readonly issues: readonly Issue[];
  /** One per rendered bound control, in result document order (task 4). */
  readonly marks: readonly ControlMark[];
}

/** ISO 8601 date-time with seconds optional, fraction optional, and a required offset. */
const NOW =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))$/;
/** BCP 47 shape: a 2–3 letter language, then subtags of 1–8 letters or digits. */
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;

export function renderView(prepared: PreparedView, input: RenderInput): RenderResult {
  const { template, ir, compiled, file, controlAt, required } = preparedInternals(prepared);
  checkNow(input.now);
  const locale = input.locale ?? 'en-US';
  if (!LOCALE.test(locale)) {
    throw new AfterlifeError('INVALID_RENDER_INPUT', { field: 'locale', value: locale });
  }

  const xml = xmlContext(
    resolveLimits({
      ...(input.limits?.xmlDepth === undefined ? {} : { xmlDepth: input.limits.xmlDepth }),
      ...(input.limits?.xmlBytes === undefined ? {} : { xmlBytes: input.limits.xmlBytes }),
    }),
  );
  const { bytes, name } = recordOf(prepared, input, file, template.manifest.fileNew?.attrs.href);
  const record = parseXmlDom(bytes, name, xml);
  const issues: Issue[] = [...prepared.issues, ...record.issues];
  const mismatch = templateMismatch(bytes, name, template.manifest.documentClass.attrs);
  if (mismatch) issues.push(mismatch);

  // input.limits' RenderLimits keys are enforced from task 5 (design §6).
  const documents = new Map<string, DomDocument | undefined>();
  const run = runView(compiled, record.doc, {
    functions: functionTable({ now: input.now, locale, userName: input.userName ?? '' }),
    host: { report: (i) => issues.push(i) },
    loadDocument: (docName) => {
      const key = docName.toLowerCase();
      if (!documents.has(key)) {
        const docBytes = file(docName);
        documents.set(key, docBytes && parseXmlDom(docBytes, docName, xml).doc);
      }
      return documents.get(key);
    },
    budget: new Budget(),
    sourceFile: name,
    controlAt,
  });
  issues.push(...run.issues);
  if (run.unmarked > 0) {
    issues.push({
      code: 'CONTROL_NOT_MARKED',
      message: `${compiled.xslFile}: ${run.unmarked} element(s) with xd:binding are not FormIR controls; no mark`,
      file: compiled.xslFile,
      details: { count: run.unmarked },
    });
  }

  const scope = scopeId(ir.meta.urn ?? '', ir.meta.solutionVersion ?? '', prepared.view.name);
  const namespaces = template.manifest.namespaces;
  const post = postProcess(run.fragment, scope, compiled.xslFile, run.marked, (m) =>
    controlMark(m, namespaces, required),
  );
  issues.push(...post.issues);

  return Object.freeze({
    html: post.html,
    css: post.css,
    issues: Object.freeze(issues),
    marks: Object.freeze(post.marks.map((m) => Object.freeze(m))),
  });
}

/** @internal Design §8.1: the result tree → sanitised HTML, scoped CSS and their issues. */
export function postProcess(
  fragment: DomFragment,
  scope: string,
  xslFile: string,
  marked: ReadonlyMap<object, MarkedElement> = new Map(),
  markOf: (m: MarkedElement) => ControlMark = () => {
    throw new AfterlifeError('INTERNAL', { path: 'postProcess', reason: 'no mark function' });
  },
): { html: string; css: string; issues: Issue[]; marks: ControlMark[] } {
  const page = sanitiseResult(fragment as DomFragment & ResultNode, scope);
  const marks = applyMarks(page.root, (origin) => {
    const m = marked.get(origin);
    return m && markOf(m);
  });
  const removed = new Map(page.removed);
  const css = [...page.styles.map((s) => scopeCss(s, scope, removed.get('css')!)), OWN_CSS];
  return {
    html: serialiseHtml(page.root),
    css: css.filter((c) => c !== '').join('\n'),
    issues: postIssues(xslFile, page.rawTextNodes, removed),
    marks,
  };
}

/** D6 and §8.2: one OUTPUT_ESCAPING_IGNORED, then one CONTENT_REMOVED per kind. */
function postIssues(
  file: string,
  rawTextNodes: number,
  removed: ReadonlyMap<string, Removed>,
): Issue[] {
  const out: Issue[] = [];
  if (rawTextNodes > 0) {
    out.push({
      code: 'OUTPUT_ESCAPING_IGNORED',
      message: `${file}: disable-output-escaping ignored on ${rawTextNodes} text node(s); written as text`,
      file,
      details: { nodes: rawTextNodes },
    });
  }
  for (const kind of REMOVED_KINDS) {
    const names = removed.get(kind) ?? [];
    if (names.length === 0) continue;
    const distinct = [...new Set(names)];
    out.push({
      code: 'CONTENT_REMOVED',
      message: `${file}: ${names.length} ${kind} item(s) removed: ${distinct.slice(0, 5).join(', ')}${distinct.length > 5 ? ', …' : ''}`,
      file,
      details: { kind, count: names.length },
    });
  }
  return out;
}

function checkNow(now: unknown): void {
  const m = typeof now === 'string' ? NOW.exec(now) : null;
  const ok =
    m !== null &&
    inRange(m[2], 1, 12) &&
    inRange(m[3], 1, 31) &&
    inRange(m[4], 0, 23) &&
    inRange(m[5], 0, 59) &&
    (m[6] === undefined || inRange(m[6], 0, 59)) &&
    (m[8] === undefined || (inRange(m[8], 0, 23) && inRange(m[9], 0, 59)));
  if (!ok) throw new AfterlifeError('INVALID_RENDER_INPUT', { field: 'now', value: String(now) });
}

const inRange = (digits: string | undefined, min: number, max: number) =>
  digits !== undefined && Number(digits) >= min && Number(digits) <= max;

function recordOf(
  prepared: PreparedView,
  input: RenderInput,
  file: (name: string) => Uint8Array | undefined,
  initial: string | undefined,
): { bytes: Uint8Array; name: string } {
  if (input.record !== undefined) return { bytes: input.record, name: 'record.xml' };
  const bytes = initial === undefined ? undefined : file(initial);
  if (initial === undefined || bytes === undefined) {
    throw new AfterlifeError('INVALID_RENDER_INPUT', {
      field: 'record',
      value: `no record given, and view ${prepared.view.name}'s template has no initialXmlDocument file`,
    });
  }
  return { bytes, name: initial };
}

/** R2.1: the record's `mso-infoPathSolution` names another URN or `solutionVersion`. */
function templateMismatch(
  bytes: Uint8Array,
  file: string,
  documentClass: Readonly<Record<string, string | undefined>>,
): Issue | undefined {
  const record = {
    urn: solutionAttribute(bytes, 'name'),
    version: solutionAttribute(bytes, 'solutionVersion'),
  };
  const template = { urn: documentClass.name, version: documentClass.solutionVersion };
  const differs = (a: string | undefined, b: string | undefined) =>
    a !== undefined && b !== undefined && a !== b;
  if (!differs(record.urn, template.urn) && !differs(record.version, template.version)) {
    return undefined;
  }
  return {
    code: 'RECORD_TEMPLATE_MISMATCH',
    message:
      `${file}: made with ${record.urn ?? '?'} version ${record.version ?? '?'}; rendered with ` +
      `${template.urn ?? '?'} version ${template.version ?? '?'}`,
    file,
    details: {
      recordUrn: record.urn ?? '',
      recordVersion: record.version ?? '',
      templateUrn: template.urn ?? '',
      templateVersion: template.version ?? '',
    },
  };
}
