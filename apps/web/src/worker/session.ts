// Spec 09 design §4, D1: the Worker's session. It owns every template and record, parsed once,
// and each view compiled once; the page asks for renders by id. Runs core; nothing else here does.
import {
  AfterlifeError,
  buildFormIR,
  DEFAULT_LIMITS,
  exportRecords,
  FillCommandError,
  FillSession,
  matchRecord,
  parseXsn,
  prepareView,
  readZip,
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
  Duplicate,
  ExportedRes,
  FillCommand,
  FilledRes,
  FilledXmlRes,
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
  if (e instanceof AppError) return { code: e.code, details: { ...e.details } };
  if (e instanceof FillCommandError)
    return { code: 'FILL_PATH', details: { path: e.path, reason: e.reason } };
  if (isAfterlifeError(e)) return { code: e.code, details: { ...e.details } };
  return {
    code: 'WORKER_FAILED',
    details: { message: e instanceof Error ? e.message : String(e) },
  };
}

/** Spec 13 B3: a file's identity is its bytes, whatever its name. Web Crypto, in Node and Workers. */
async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

const MiB = 1024 * 1024;
/**
 * Spec 09 R12.8: a `.zip` (a SharePoint library download) may hold many forms. Its own limits,
 * through core's `Limits`; each entry still meets its file type's limit (`collect.ts`).
 */
export const ZIP_LIMITS = { inputBytes: 200 * MiB, uncompressedBytes: 500 * MiB, entries: 10_000 };
const ENTRY_MAX = { xsn: DEFAULT_LIMITS.inputBytes, xml: DEFAULT_LIMITS.xmlBytes };

interface Item {
  readonly name: string;
  readonly sample?: string;
  readonly bytes: () => Promise<Uint8Array<ArrayBuffer>>;
}

const extOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();
const baseOf = (name: string) => name.slice(name.lastIndexOf('/') + 1);

const byName = <T extends { readonly fileName: string }>(a: T, b: T) =>
  a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0;

export class Session {
  private readonly templates: Template[] = [];
  private readonly records: StoredRecord[] = [];
  private readonly failures: FileFailure[] = [];
  private next = 1;
  /** Every file this session took in, by SHA-256: the template it became, if it did. */
  private readonly seen = new Map<string, { readonly templateId?: string }>();

  private last: TriageResult | undefined;
  /** Spec 04 D1: at most one fill session, for one template's empty form or one record. */
  private fillState:
    | {
        readonly template: Template;
        readonly fileName: string;
        readonly session: FillSession;
        dirty: boolean;
      }
    | undefined;

  /** The files to read: `.zip` files opened (folders walked, nested zips not), in order. */
  private items(files: readonly InputFile[], ignored: string[]): Item[] {
    const out: Item[] = [];
    for (const f of files) {
      const bytes = new Uint8Array(f.bytes);
      if (extOf(f.name) !== 'zip') {
        out.push({
          name: f.name,
          bytes: () => Promise.resolve(bytes),
          ...(f.sample !== undefined && { sample: f.sample }),
        });
        continue;
      }
      try {
        for (const e of readZip(bytes, { limits: ZIP_LIMITS })) {
          if (e.directory) continue;
          const ext = extOf(e.name);
          const name = baseOf(e.name);
          if (ext !== 'xsn' && ext !== 'xml') ignored.push(`${f.name} › ${e.name}`);
          else if (e.size > ENTRY_MAX[ext])
            this.failures.push({
              fileName: name,
              error: { code: 'FILE_TOO_LARGE', details: { max: ENTRY_MAX[ext], observed: e.size } },
            });
          else out.push({ name, bytes: () => e.read() });
        }
      } catch (e) {
        this.failures.push({ fileName: f.name, error: toWireError(e) });
      }
    }
    return out;
  }

  async open(files: readonly InputFile[], progress?: Progress): Promise<SessionRes> {
    const duplicates: Duplicate[] = [];
    const ignored: string[] = [];
    const items = this.items(files, ignored);
    for (const [i, f] of items.entries()) {
      progress?.({ type: 'progress', index: i + 1, total: items.length, fileName: f.name });
      const ext = extOf(f.name);
      if (ext !== 'xsn' && ext !== 'xml') continue;
      let bytes: Uint8Array<ArrayBuffer>;
      try {
        bytes = await f.bytes();
      } catch (e) {
        this.failures.push({ fileName: f.name, error: toWireError(e) });
        continue;
      }
      const hash = await sha256(bytes);
      const seen = this.seen.get(hash);
      if (seen) {
        duplicates.push({ fileName: f.name, ...seen });
        continue;
      }
      try {
        if (ext === 'xsn') {
          const templateId = await this.addTemplate(f.name, bytes, f.sample);
          this.seen.set(hash, { templateId });
        } else this.addRecord(f.name, bytes);
      } catch (e) {
        this.failures.push({ fileName: f.name, error: toWireError(e) });
      }
      // A failed file is kept once too, as its failure.
      if (!this.seen.has(hash)) this.seen.set(hash, {});
    }
    return { ...this.summary(), duplicates, ignored };
  }

  /** Spec 09 R12.1–R12.4: the records matched to one template, exported. */
  async exportRecords(
    templateId: string,
    format: 'xlsx' | 'csv',
    progress?: Progress,
  ): Promise<ExportedRes> {
    const t = this.templates.find((x) => x.summary.templateId === templateId);
    if (!t)
      throw new AfterlifeError('INTERNAL', {
        path: 'session.export',
        reason: `no template ${templateId}`,
      });
    const ids = new Set(
      this.summary()
        .records.filter((r) => r.match.kind !== 'unmatched' && r.match.templateId === templateId)
        .map((r) => r.recordId),
    );
    const records = this.records.filter((r) => ids.has(r.recordId));
    const fileName = `${t.summary.fileName.replace(/\.xsn$/i, '')}-records.${format === 'xlsx' ? 'xlsx' : 'zip'}`;
    const out = await exportRecords(t.summary.ir, records, {
      format,
      date: new Date(),
      progress: (index, total, name) =>
        progress?.({ type: 'progress', index, total, fileName: name }),
    });
    return {
      type: 'exported',
      fileName,
      bytes: out.bytes.buffer,
      records: out.records,
      files: out.files,
      unread: out.unread.length,
    };
  }

  private async addTemplate(fileName: string, bytes: Uint8Array, sample?: string): Promise<string> {
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
    return templateId;
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
      duplicates: [],
      ignored: [],
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

  // --- Spec 04: fill-in mode ------------------------------------------------------------------

  private template(templateId: string): Template {
    const t = this.templates.find((x) => x.summary.templateId === templateId);
    if (!t)
      throw new AfterlifeError('INTERNAL', {
        path: 'session.fill',
        reason: `no template ${templateId}`,
      });
    return t;
  }

  private prepared(t: Template, view: string): Promise<PreparedView> {
    let prepared = t.views.get(view);
    if (!prepared) {
      prepared = prepareView(t.parsed, t.summary.ir, { view });
      t.views.set(view, prepared);
      prepared.catch(() => t.views.delete(view));
    }
    return prepared;
  }

  /** R1.1, R1.5: a session on the empty form, or on a record of exactly this version. */
  async fillOpen(
    templateId: string,
    recordId: string | undefined,
    view: string,
    now: string,
  ): Promise<FilledRes> {
    const t0 = performance.now();
    const t = this.template(templateId);
    const record =
      recordId === undefined ? undefined : this.records.find((r) => r.recordId === recordId);
    if (recordId !== undefined) {
      const m = record && this.summary().records.find((r) => r.recordId === recordId)?.match;
      if (!record || m?.kind !== 'exact' || m.templateId !== templateId)
        throw new AppError('FILL_STATE', { reason: 'version', recordId });
    }
    const session = FillSession.open(t.parsed, t.summary.ir, {
      now,
      ...(record && { record: record.bytes }),
    });
    const base = t.summary.fileName.replace(/\.xsn$/i, '');
    this.fillState = {
      template: t,
      fileName: record?.fileName ?? `${base}-new.xml`,
      session,
      dirty: false,
    };
    const workedOut = record
      ? new Set(
          session.opened.changes
            .filter(
              (c) =>
                c.before === '' &&
                session.opened.trace.some(
                  (e) => e.kind === 'calc' && e.changes.some((x) => x.path === c.path),
                ),
            )
            .map((c) => c.path),
        ).size
      : 0;
    return this.filled(view, now, session.opened, workedOut, t0);
  }

  /** R1.3, R2.1: one command, then a render of `view`. */
  async fill(command: FillCommand, view: string, now: string): Promise<FilledRes> {
    const t0 = performance.now();
    const f = this.fillState;
    if (!f) throw new AppError('FILL_STATE', { reason: 'closed' });
    const a =
      command.kind === 'edit'
        ? f.session.edit(command.path, command.value, now)
        : command.kind === 'press'
          ? f.session.press(command.ctrlId, command.path, now)
          : undefined;
    if (a && a.changes.length > 0) f.dirty = true;
    return this.filled(view, now, a, 0, t0);
  }

  /** R8.1: the record with its processing instructions, as UTF-8. Downloaded is not dirty. */
  fillDownload(): FilledXmlRes {
    const f = this.fillState;
    if (!f) throw new AppError('FILL_STATE', { reason: 'closed' });
    const xml = f.session.xml().replace(/^<\?xml[^>]*\?>\s*/, '');
    const bytes = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`);
    f.dirty = false;
    return {
      type: 'filledXml',
      fileName: f.fileName,
      bytes: bytes.buffer,
      invalid: f.session.invalid().length,
    };
  }

  fillClose(): void {
    this.fillState = undefined;
  }

  private async filled(
    view: string,
    now: string,
    a: ReturnType<FillSession['edit']> | undefined,
    workedOut: number,
    t0: number,
  ): Promise<FilledRes> {
    const f = this.fillState!;
    const r = renderView(await this.prepared(f.template, view), {
      now,
      locale: 'en-US',
      record: new TextEncoder().encode(f.session.xml()),
    });
    const values: Record<string, string> = {};
    const calculated: string[] = [];
    for (const m of r.marks) {
      if (m.path === undefined || m.path in values) continue;
      values[m.path] = f.session.text(m.path) ?? '';
      if (m.fieldId !== undefined && f.session.calculated(m.fieldId)) calculated.push(m.path);
    }
    const invalid = (a?.invalid ?? f.session.invalid()).map(({ path, short, message }) => ({
      path,
      short,
      message,
    }));
    return {
      type: 'filled',
      html: r.html,
      css: r.css,
      issues: r.issues,
      marks: r.marks,
      values,
      calculated,
      invalid,
      trace: a?.trace ?? [],
      dialogs: a?.dialogs ?? [],
      notices: a?.notices ?? [],
      ...(a?.view !== undefined && { view: a.view }),
      dirty: f.dirty,
      workedOut,
      ms: performance.now() - t0,
    };
  }
}

/** An app-level error with its code (`FILL_PATH`, `FILL_STATE`), carried as a WireError. */
export class AppError extends Error {
  constructor(
    readonly code: 'FILL_PATH' | 'FILL_STATE',
    readonly details: Readonly<Record<string, unknown>>,
  ) {
    super(code);
  }
}
