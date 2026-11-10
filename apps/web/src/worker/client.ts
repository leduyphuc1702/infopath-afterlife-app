// Spec 09 design §4: the page's side of the Worker. Each request gets an id and a promise; an
// answer that takes more than 15 s ends the Worker, which is started again and given the files
// it held (the watchdog; core's own budgets should make it unnecessary).
import type { InputFile, ReqBody, ResBody } from './protocol';

export const WATCHDOG_MS = 15_000;

type Pending = { resolve: (r: ResBody) => void; timer: ReturnType<typeof setTimeout> };
/** What the Worker was given, to give it again after a restart. */
type Replay = { type: 'openSample'; sample: string } | { type: 'open'; files: readonly File[] };

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
    w.onmessage = (e: MessageEvent<ResBody & { id: number }>) => {
      const { id, ...body } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(id);
      p.resolve(body);
    };
    return w;
  }

  private send(body: ReqBody, transfer: Transferable[] = []): Promise<ResBody> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          type: 'failed',
          error: { code: 'WORKER_TIMEOUT', details: { ms: this.timeoutMs } },
        });
        void this.restart();
      }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.worker.postMessage({ ...body, id }, transfer);
    });
  }

  private async restart(): Promise<void> {
    this.worker.terminate();
    this.worker = this.start();
    for (const r of this.replay)
      await (r.type === 'openSample' ? this.send(r) : this.sendFiles(r.files));
  }

  private async sendFiles(files: readonly File[]): Promise<ResBody> {
    const input: InputFile[] = await Promise.all(
      files.map(async (f) => ({ name: f.name, bytes: await f.arrayBuffer() })),
    );
    return this.send(
      { type: 'open', files: input },
      input.map((f) => f.bytes),
    );
  }

  warm(): Promise<ResBody> {
    return this.send({ type: 'warm' });
  }

  openSample(sample: string): Promise<ResBody> {
    this.replay.push({ type: 'openSample', sample });
    return this.send({ type: 'openSample', sample });
  }

  open(files: readonly File[]): Promise<ResBody> {
    this.replay.push({ type: 'open', files });
    return this.sendFiles(files);
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
