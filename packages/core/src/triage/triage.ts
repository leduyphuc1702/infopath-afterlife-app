// Spec 12 R3.1–R3.4, R6.1, P10, design §5: one row per template, in a fixed order.
// `triage` takes parsed templates and matched records; `triageFiles` does the parsing and the
// matching itself, so the Worker, the Forge resolver and the private-corpus test share one path.
import { classify } from '../coverage/classify';
import { COVERAGE_CLASSES, type CoverageClass } from '../coverage/table';
import { AfterlifeError, type ErrorCode } from '../errors';
import { buildFormIR } from '../ir/build';
import type { FormIR, Generation } from '../ir/types';
import { matchRecord } from '../xsn/match';
import { parseXsn } from '../xsn/parse';
import { CAUSE_IDS, type CauseId } from './catalogue';
import { causesOf, type Cause } from './causes';
import { recordEvidence, type RecordEvidence } from './record';
import { waveOf, type Wave } from './wave';

export interface TriageTemplate {
  readonly templateId: string;
  readonly fileName: string;
  readonly ir: FormIR;
}

export interface TriageRecord {
  readonly evidence: RecordEvidence;
  /** The template `matchRecord` gave it (`exact` or `otherVersion`); absent when unmatched. */
  readonly templateId?: string;
}

export interface TriageFailure {
  readonly fileName: string;
  readonly code: ErrorCode | 'INTERNAL';
}

export interface TriageInput {
  readonly templates: readonly TriageTemplate[];
  readonly records: readonly TriageRecord[];
  readonly failures: readonly TriageFailure[];
}

export interface TriageRow {
  readonly kind: 'form';
  readonly templateId: string;
  readonly fileName: string;
  readonly name: string;
  readonly urn?: string;
  readonly generation: Generation;
  readonly browserCompatible: boolean;
  readonly counts: {
    readonly fields: number;
    readonly repeatingGroups: number;
    readonly views: number;
    /** Actions plus calculations plus validations (the brief's definition). */
    readonly rules: number;
    readonly connections: number;
  };
  readonly coverage: Readonly<Record<CoverageClass, number>>;
  /** Native over all items, rounded down; absent when there are no items. */
  readonly nativePercent?: number;
  /** Absent ("—") when no record was opened at all (R6.1). */
  readonly records?: number;
  readonly causes: readonly Cause[];
  readonly wave: Wave;
}

export interface TriageError {
  readonly kind: 'error';
  readonly fileName: string;
  readonly code: TriageFailure['code'];
}

export interface TriageTotals {
  readonly forms: number;
  readonly errors: number;
  readonly waves: Readonly<Record<Wave, number>>;
  /** Forms per cause, in catalogue order. */
  readonly causes: Readonly<Record<CauseId, number>>;
}

export interface TriageResult {
  readonly rows: readonly (TriageRow | TriageError)[];
  readonly totals: TriageTotals;
}

/** Code-point order, so the result does not depend on a locale (Intl is not allowed in core). */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function rowOf(
  t: TriageTemplate,
  records: readonly TriageRecord[],
  anyRecords: boolean,
): TriageRow {
  const { ir } = t;
  const mine = records.filter((r) => r.templateId === t.templateId);
  const coverage = classify(ir).counts;
  const total = COVERAGE_CLASSES.reduce((n, k) => n + coverage[k], 0);
  const main = <T extends { dataSource: string }>(xs: readonly T[]) =>
    xs.filter((x) => x.dataSource === 'main');
  return {
    kind: 'form',
    templateId: t.templateId,
    fileName: t.fileName,
    name: ir.meta.name || t.fileName,
    ...(ir.meta.urn !== undefined && { urn: ir.meta.urn }),
    generation: ir.meta.generation,
    browserCompatible: ir.meta.browserCompatible,
    counts: {
      fields: main(ir.fields).length,
      repeatingGroups: main(ir.groups).filter((g) => g.repeating).length,
      views: ir.views.length,
      rules:
        ir.rules.reduce((n, r) => n + r.actions.length, 0) +
        ir.calculations.length +
        ir.validations.length,
      connections: ir.dataConnections.length,
    },
    coverage,
    ...(total > 0 && { nativePercent: Math.floor((coverage.native * 100) / total) }),
    ...(anyRecords && { records: mine.length }),
    causes: causesOf(
      ir,
      mine.map((r) => r.evidence),
    ),
    wave: waveOf(coverage),
  };
}

function order(a: TriageRow, b: TriageRow): number {
  return (
    a.wave - b.wave ||
    (b.records ?? -1) - (a.records ?? -1) ||
    cmp(a.name, b.name) ||
    cmp(a.fileName, b.fileName) ||
    cmp(a.templateId, b.templateId)
  );
}

export function triage(input: TriageInput): TriageResult {
  const anyRecords = input.records.length > 0;
  const forms = input.templates.map((t) => rowOf(t, input.records, anyRecords)).sort(order);
  const errors = input.failures
    .map((f): TriageError => ({ kind: 'error', fileName: f.fileName, code: f.code }))
    .sort((a, b) => cmp(a.fileName, b.fileName) || cmp(a.code, b.code));
  const waves: Record<Wave, number> = { 1: 0, 2: 0, 3: 0 };
  const causes = Object.fromEntries(CAUSE_IDS.map((id) => [id, 0])) as Record<CauseId, number>;
  for (const r of forms) {
    waves[r.wave]++;
    for (const c of r.causes) causes[c.id]++;
  }
  return {
    rows: [...forms, ...errors],
    totals: { forms: forms.length, errors: errors.length, waves, causes },
  };
}

export interface InputFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

const byNameThenBytes = (a: InputFile, b: InputFile) => {
  const n = cmp(a.name, b.name);
  if (n !== 0) return n;
  for (let i = 0; i < Math.min(a.bytes.length, b.bytes.length); i++)
    if (a.bytes[i] !== b.bytes[i]) return a.bytes[i]! - b.bytes[i]!;
  return a.bytes.length - b.bytes.length;
};

/**
 * Parses `.xsn` files, matches `.xml` records, and triages them. A template that fails becomes
 * an error row with its code; the batch continues (R3.2). Other files are ignored. Template ids
 * are file names, with `#2`, `#3`… for repeats in a fixed order, so the result does not depend
 * on the input order (P10).
 */
export async function triageFiles(files: readonly InputFile[]): Promise<TriageResult> {
  const lower = (f: InputFile) => f.name.toLowerCase();
  const xsn = files.filter((f) => lower(f).endsWith('.xsn')).sort(byNameThenBytes);
  const xml = files.filter((f) => lower(f).endsWith('.xml')).sort(byNameThenBytes);
  const seen = new Map<string, number>();
  const templates: TriageTemplate[] = [];
  const failures: TriageFailure[] = [];
  for (const f of xsn) {
    const n = (seen.get(f.name) ?? 0) + 1;
    seen.set(f.name, n);
    try {
      const ir = buildFormIR(await parseXsn(f.bytes));
      templates.push({ templateId: n === 1 ? f.name : `${f.name}#${n}`, fileName: f.name, ir });
    } catch (e) {
      const code: ErrorCode | 'INTERNAL' =
        e instanceof AfterlifeError ? (e as AfterlifeError).code : 'INTERNAL';
      failures.push({ fileName: f.name, code });
    }
  }
  const keys = templates.map((t) => ({
    ...(t.ir.meta.urn !== undefined && { urn: t.ir.meta.urn }),
    ...(t.ir.meta.solutionVersion !== undefined && { version: t.ir.meta.solutionVersion }),
    ...(t.ir.meta.publishUrl !== undefined && { publishUrl: t.ir.meta.publishUrl }),
  }));
  const records = xml.map((f): TriageRecord => {
    const m = matchRecord(f.bytes, keys);
    const evidence = recordEvidence(f.name, f.bytes);
    return m.kind === 'unmatched'
      ? { evidence }
      : { evidence, templateId: templates[m.template]!.templateId };
  });
  return triage({ templates, records, failures });
}
