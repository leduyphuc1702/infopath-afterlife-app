// Spec 09 design §4: the page's side of the Worker. Each request gets an id and a promise; an
// answer that takes more than 15 s ends the Worker, which is started again and given the files
// it held (the watchdog; core's own budgets should make it unnecessary).
import type { SummaryQuery } from '@afterlife/core';
import type { FillCommand, InputFile, Progress, ReqBody, Res, ResBody } from './protocol';

export const WATCHDOG_MS = 15_000;

type Pending = {
  resolve: (r: ResBody) => void;
  timer: ReturnType<typeof setTimeout>;
  /** Restarts the watchdog: progress means the Worker is alive (spec 12 R4.4). */
  arm: () => void;
  progress?: Progress;
};
/** What the Worker was given, to give it again after a restart. */
type Replay =
  | { type: 'openSample'; sample: string }
  | { type: 'openAllSamples' }
  | { type: 'open'; files: readonly File[] };

export class WorkerClient {
  private worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly replay: Replay[] = [];

  constructor(
    private readonly create: () => Worker = () =>
      new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'afterlife' }),
    private readonly timeoutMs = WATCHDOG_MS,
  ) {
    this.worker = this.start();
  }

  private start(): Worker {
    const w = this.create();
    w.onmessage = (e: MessageEvent<Res>) => {
      const { id, ...body } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      if (body.type === 'progress') {
        p.arm();
        p.progress?.(body);
        return;
      }
      clearTimeout(p.timer);
      this.pending.delete(id);
      p.resolve(body);
    };
    return w;
  }

  private send(
    body: ReqBody,
    transfer: Transferable[] = [],
    progress?: Progress,
  ): Promise<ResBody> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const expire = () => {
        this.pending.delete(id);
        resolve({
          type: 'failed',
          error: { code: 'WORKER_TIMEOUT', details: { ms: this.timeoutMs } },
        });
        void this.restart();
      };
      const p: Pending = {
        resolve,
        timer: setTimeout(expire, this.timeoutMs),
        arm: () => {
          clearTimeout(p.timer);
          p.timer = setTimeout(expire, this.timeoutMs);
        },
        ...(progress && { progress }),
      };
      this.pending.set(id, p);
      this.worker.postMessage({ ...body, id }, transfer);
    });
  }

  private async restart(): Promise<void> {
    this.worker.terminate();
    this.worker = this.start();
    for (const r of this.replay) await (r.type === 'open' ? this.sendFiles(r.files) : this.send(r));
  }

  private async sendFiles(files: readonly File[], progress?: Progress): Promise<ResBody> {
    const input: InputFile[] = await Promise.all(
      files.map(async (f) => ({ name: f.name, bytes: await f.arrayBuffer() })),
    );
    return this.send(
      { type: 'open', files: input },
      input.map((f) => f.bytes),
      progress,
    );
  }

  warm(): Promise<ResBody> {
    return this.send({ type: 'warm' });
  }

  openSample(sample: string, progress?: Progress): Promise<ResBody> {
    this.replay.push({ type: 'openSample', sample });
    return this.send({ type: 'openSample', sample }, [], progress);
  }

  open(files: readonly File[], progress?: Progress): Promise<ResBody> {
    this.replay.push({ type: 'open', files });
    return this.sendFiles(files, progress);
  }

  /** Spec 12 R4.5: every bundled sample at once. */
  openAllSamples(progress?: Progress): Promise<ResBody> {
    this.replay.push({ type: 'openAllSamples' });
    return this.send({ type: 'openAllSamples' }, [], progress);
  }

  /** Spec 09 R12.1: one template's records as a workbook or a zip of CSVs. */
  exportRecords(templateId: string, format: 'xlsx' | 'csv', progress?: Progress): Promise<ResBody> {
    return this.send({ type: 'exportRecords', templateId, format }, [], progress);
  }

  /** Spec 15 R3: one form's dossier. */
  documentation(templateId: string): Promise<ResBody> {
    return this.send({ type: 'documentation', templateId }, []);
  }

  /** Spec 18: records as web pages. */
  archive(
    req: {
      templateId: string;
      views: readonly string[];
      recordIds?: readonly string[];
      now: string;
      css: string;
    },
    progress?: Progress,
  ): Promise<ResBody> {
    return this.send({ type: 'archive', ...req }, [], progress);
  }

  /** Spec 18 R8: stops a running archive; it answers `cancelled`. No answer of its own. */
  cancel(): void {
    this.worker.postMessage({ type: 'cancel', id: -1 });
  }

  /** Spec 17: the open template's records as a list. */
  recordList(templateId: string, now: string): Promise<ResBody> {
    return this.send({ type: 'recordList', templateId, now }, []);
  }

  /** Spec 20: the found records summarized. */
  summary(
    templateId: string,
    query: SummaryQuery,
    recordIds: readonly string[],
    now: string,
  ): Promise<ResBody> {
    return this.send({ type: 'summary', templateId, query, recordIds, now }, []);
  }

  /** Spec 15 R3.3: the Markdown of several forms, with an index, as a `.zip`. */
  documentationZip(templateIds: readonly string[]): Promise<ResBody> {
    return this.send({ type: 'documentationZip', templateIds }, []);
  }

  /** Spec 04 R1.1: open a fill session (the empty form when `recordId` is absent). */
  fillOpen(
    templateId: string,
    recordId: string | undefined,
    view: string,
    now: string,
  ): Promise<ResBody> {
    return this.send({
      type: 'fillOpen',
      templateId,
      view,
      now,
      ...(recordId !== undefined && { recordId }),
    });
  }

  /** Spec 04 R1.3: one command; the answer renders `view`. */
  fill(command: FillCommand, view: string, now: string): Promise<ResBody> {
    return this.send({ type: 'fill', command, view, now });
  }

  fillDownload(): Promise<ResBody> {
    return this.send({ type: 'fillDownload' });
  }

  fillClose(): Promise<ResBody> {
    return this.send({ type: 'fillClose' });
  }

  /** Spec 12 R5.1: the open session's Triage as CSV text. */
  csv(): Promise<ResBody> {
    return this.send({ type: 'csv' });
  }

  render(
    templateId: string,
    view: string,
    recordId: string | undefined,
    now: string,
  ): Promise<ResBody> {
    return this.send({
      type: 'render',
      templateId,
      view,
      now,
      ...(recordId !== undefined && { recordId }),
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}

/** The page's local time with its offset, as `renderView` needs it (`2026-11-11T01:38:07+07:00`). */
export function localNow(d = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:` +
    `${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}
