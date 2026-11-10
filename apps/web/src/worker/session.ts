// Spec 09 design §4, D1: the Worker's session. It owns every template and record, parsed once,
// and each view compiled once; the page asks for renders by id. Runs core; nothing else here does.
import {
  AfterlifeError,
  buildFormIR,
  DEFAULT_LIMITS,
  matchRecord,
  parseXsn,
  prepareView,
  recordEvidence,
  renderView,
  toCsv,
  triage,
  type ErrorCode,
  type FormIR,
  type ParsedTemplate,
  type PreparedView,
  type RecordEvidence,
  type TriageRecord,
  type TriageResult,
} from '@afterlife/core';
import type {
  FileFailure,
  InputFile,
  Progress,
  RecordSummary,
  RenderedRes,
  SessionRes,
  TemplateSummary,
  WireError,
  WireMatch,
} from './protocol';
import { sampleName } from '../shell/sample-names';

interface Template {
  readonly summary: TemplateSummary;
  readonly parsed: ParsedTemplate;
  readonly views: Map<string, Promise<PreparedView>>;
  /** Set for a bundled sample (spec 12): Triage shows `sampleName(sample)`. */
  readonly sample?: string;
}
interface StoredRecord {
  readonly recordId: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
  /** Spec 12 R6.2: what its first 4 KB say about its template. */
  readonly evidence: RecordEvidence;
}

/** `instanceof` alone gives `AfterlifeError<any>`; this narrows to the union of codes. */
const isAfterlifeError = (e: unknown): e is AfterlifeError => e instanceof AfterlifeError;

export function toWireError(e: unknown): WireError {
  if (isAfterlifeError(e)) return { code: e.code, details: { ...e.details } };
  return {
    code: 'WORKER_FAILED',
    details: { message: e instanceof Error ? e.message : String(e) },
  };
}

const byName = <T extends { readonly fileName: string }>(a: T, b: T) =>
  a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0;

export class Session {
  private readonly templates: Template[] = [];
  private readonly records: StoredRecord[] = [];
  private readonly failures: FileFailure[] = [];
  private next = 1;

  private last: TriageResult | undefined;

  async open(files: readonly InputFile[], progress?: Progress): Promise<SessionRes> {
    for (const [i, f] of files.entries()) {
      progress?.({ type: 'progress', index: i + 1, total: files.length, fileName: f.name });
      const bytes = new Uint8Array(f.bytes);
      const ext = f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase();
      try {
        if (ext === 'xsn') await this.addTemplate(f.name, bytes, f.sample);
        else if (ext === 'xml') this.addRecord(f.name, bytes);
      } catch (e) {
        this.failures.push({ fileName: f.name, error: toWireError(e) });
      }
    }
    return this.summary();
  }

  private async addTemplate(fileName: string, bytes: Uint8Array, sample?: string): Promise<void> {
    const parsed = await parseXsn(bytes);
    const ir: FormIR = buildFormIR(parsed);
    const templateId = `t${this.next++}`;
    this.templates.push({
      summary: { templateId, fileName, ir },
      parsed,
      views: new Map(),
      ...(sample !== undefined && { sample }),
    });
    this.templates.sort((a, b) => byName(a.summary, b.summary));
  }

  private addRecord(fileName: string, bytes: Uint8Array): void {
    if (bytes.byteLength > DEFAULT_LIMITS.xmlBytes)
      throw new AfterlifeError('LIMIT_EXCEEDED', {
        limit: 'xmlBytes',
        max: DEFAULT_LIMITS.xmlBytes,
        observed: bytes.byteLength,
      });
    this.records.push({
      recordId: `r${this.next++}`,
      fileName,
      bytes,
      evidence: recordEvidence(fileName, bytes),
    });
    this.records.sort(byName);
  }

  /** Every record is matched again, so a template opened later picks up earlier records. */
  summary(): SessionRes {
    const keys = this.templates.map(({ summary: { ir } }) => ({
      ...(ir.meta.urn !== undefined && { urn: ir.meta.urn }),
      ...(ir.meta.solutionVersion !== undefined && { version: ir.meta.solutionVersion }),
    }));
    const records: RecordSummary[] = this.records.map((r) => {
      const m = matchRecord(r.bytes, keys);
      const id = (i: number) => this.templates[i]!.summary.templateId;
      const match: WireMatch =
        m.kind === 'exact'
          ? { kind: 'exact', templateId: id(m.template) }
          : m.kind === 'otherVersion'
            ? { kind: 'otherVersion', templateId: id(m.template), recordVersion: m.recordVersion }
            : m;
      return { recordId: r.recordId, fileName: r.fileName, match };
    });
    this.last = this.triage(records);
    return {
      type: 'session',
      templates: this.templates.map((t) => t.summary),
      records,
      failures: [...this.failures],
      triage: this.last,
    };
  }

  /** Spec 12: the session's templates, matched records and template failures, triaged. */
  private triage(records: readonly RecordSummary[]): TriageResult {
    const tr: TriageRecord[] = records.map((r, i) => {
      const { evidence } = this.records[i]!;
      return r.match.kind === 'unmatched'
        ? { evidence }
        : { evidence, templateId: r.match.templateId };
    });
    return triage({
      // Bundled samples show their display name; a user's own files keep core's name.
      templates: this.templates.map(({ summary: t, sample }) =>
        sample === undefined
          ? t
          : { ...t, ir: { ...t.ir, meta: { ...t.ir.meta, name: sampleName(sample) } } },
      ),
      records: tr,
      failures: this.failures
        .filter((f) => f.fileName.toLowerCase().endsWith('.xsn'))
        .map((f) => ({
          fileName: f.fileName,
          code: f.error.code === 'WORKER_FAILED' ? 'INTERNAL' : (f.error.code as ErrorCode),
        })),
    });
  }

  /** Spec 12 R5.1: the plan as CSV, from the last session answer. */
  csv(): string {
    return toCsv(this.last ?? this.triage([]));
  }

  async render(
    templateId: string,
    view: string,
    recordId: string | undefined,
    now: string,
  ): Promise<RenderedRes> {
    const t = this.templates.find((x) => x.summary.templateId === templateId);
    if (!t)
      throw new AfterlifeError('INTERNAL', {
        path: 'session.render',
        reason: `no template ${templateId}`,
      });
    let prepared = t.views.get(view);
    if (!prepared) {
      prepared = prepareView(t.parsed, t.summary.ir, { view });
      t.views.set(view, prepared);
      prepared.catch(() => t.views.delete(view));
    }
    const record =
      recordId === undefined ? undefined : this.records.find((r) => r.recordId === recordId);
    if (recordId !== undefined && !record)
      throw new AfterlifeError('INTERNAL', {
        path: 'session.render',
        reason: `no record ${recordId}`,
      });
    const r = renderView(await prepared, {
      now,
      locale: 'en-US',
      ...(record && { record: record.bytes }),
    });
    return { type: 'rendered', html: r.html, css: r.css, issues: r.issues, marks: r.marks };
  }
}
