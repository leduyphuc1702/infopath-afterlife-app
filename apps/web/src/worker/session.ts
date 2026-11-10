// Spec 09 design §4, D1: the Worker's session. It owns every template and record, parsed once,
// and each view compiled once; the page asks for renders by id. Runs core; nothing else here does.
import {
  AfterlifeError,
  buildFormIR,
  DEFAULT_LIMITS,
  matchRecord,
  parseXsn,
  prepareView,
  renderView,
  type FormIR,
  type ParsedTemplate,
  type PreparedView,
} from '@afterlife/core';
import type {
  FileFailure,
  InputFile,
  RecordSummary,
  RenderedRes,
  SessionRes,
  TemplateSummary,
  WireError,
  WireMatch,
} from './protocol';

interface Template {
  readonly summary: TemplateSummary;
  readonly parsed: ParsedTemplate;
  readonly views: Map<string, Promise<PreparedView>>;
}
interface StoredRecord {
  readonly recordId: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
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

  async open(files: readonly InputFile[]): Promise<SessionRes> {
    for (const f of files) {
      const bytes = new Uint8Array(f.bytes);
      const ext = f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase();
      try {
        if (ext === 'xsn') await this.addTemplate(f.name, bytes);
        else if (ext === 'xml') this.addRecord(f.name, bytes);
      } catch (e) {
        this.failures.push({ fileName: f.name, error: toWireError(e) });
      }
    }
    return this.summary();
  }

  private async addTemplate(fileName: string, bytes: Uint8Array): Promise<void> {
    const parsed = await parseXsn(bytes);
    const ir: FormIR = buildFormIR(parsed);
    const templateId = `t${this.next++}`;
    this.templates.push({ summary: { templateId, fileName, ir }, parsed, views: new Map() });
    this.templates.sort((a, b) => byName(a.summary, b.summary));
  }

  private addRecord(fileName: string, bytes: Uint8Array): void {
    if (bytes.byteLength > DEFAULT_LIMITS.xmlBytes)
      throw new AfterlifeError('LIMIT_EXCEEDED', {
        limit: 'xmlBytes',
        max: DEFAULT_LIMITS.xmlBytes,
        observed: bytes.byteLength,
      });
    this.records.push({ recordId: `r${this.next++}`, fileName, bytes });
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
    return {
      type: 'session',
      templates: this.templates.map((t) => t.summary),
      records,
      failures: [...this.failures],
    };
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
