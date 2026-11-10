// renderView (spec 03 design §1, §3.1, §4): synchronous and pure (R1.4). Checks the inputs,
// parses the record as hostile input (R1.5), notes a record made with another template version
// (R2.1), and runs the prepared view. Task 2 returns the engine's own serialisation; tasks 3–4
// replace it with the sanitised tree, the scoped CSS and the control marks.

import { AfterlifeError, type Issue } from '../errors';
import { resolveLimits, type Limits, type RenderLimits } from '../limits';
import { parseXmlDom, xmlContext, type DomDocument } from '../xml/parse';
import { solutionAttribute } from '../xsn/package';
import { Budget } from './engine/budget';
import { engineHtml, runView } from './engine/xsltjs';
import { functionTable } from './functions';
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
  readonly html: string;
  /** View rules scoped to the root, then our own rules (task 3). */
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
  const { template, compiled, file } = preparedInternals(prepared);
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
  });
  issues.push(...run.issues);

  return Object.freeze({
    html: engineHtml(compiled, run.fragment),
    css: '',
    issues: Object.freeze(issues),
    marks: Object.freeze([]),
  });
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
