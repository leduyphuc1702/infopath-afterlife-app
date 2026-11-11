// Spec 09 design §1, §4: the Worker entry. One session per Worker; requests are answered in order.
import samples, { allSamples, warmSamples } from './samples';
import type { Progress, Req, Res, ResBody } from './protocol';
import { Session, toWireError } from './session';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage(message: Res, transfer?: Transferable[]): void;
};
const session = new Session();

async function handle(req: Req): Promise<ResBody> {
  const progress: Progress = (p) => scope.postMessage({ ...p, id: req.id });
  switch (req.type) {
    case 'warm':
      await warmSamples();
      return { type: 'ready' };
    case 'open':
      return session.open(req.files, progress);
    case 'openSample':
      return session.open(await samples(req.sample), progress);
    case 'openAllSamples':
      return session.open(await allSamples(), progress);
    case 'csv':
      return { type: 'csv', text: session.csv() };
    case 'exportRecords':
      return session.exportRecords(req.templateId, req.format, progress);
    case 'render':
      return session.render(req.templateId, req.view, req.recordId, req.now);
  }
}

let queue = Promise.resolve();
scope.onmessage = (e) => {
  const req = e.data;
  queue = queue.then(async () => {
    let body: ResBody;
    try {
      body = await handle(req);
    } catch (err) {
      body = { type: 'failed', error: toWireError(err) };
    }
    // An export's bytes are transferred, not copied (R12.4).
    scope.postMessage({ ...body, id: req.id }, body.type === 'exported' ? [body.bytes] : []);
  });
};
