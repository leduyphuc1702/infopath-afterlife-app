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
    case 'archive':
      return session.archive(req.templateId, req.views, req.recordIds, req.now, req.css, progress);
    case 'cancel':
      return { type: 'ready' };
    case 'recordList':
      return session.recordList(req.templateId, req.now);
    case 'summary':
      return session.recordSummary(req.templateId, req.query, req.recordIds, req.now);
    case 'documentation':
      return session.documentation(req.templateId);
    case 'documentationZip':
      return session.documentationZip(req.templateIds);
    case 'fillOpen':
      return session.fillOpen(req.templateId, req.recordId, req.view, req.now);
    case 'fill':
      return session.fill(req.command, req.view, req.now);
    case 'fillDownload':
      return session.fillDownload();
    case 'fillClose':
      session.fillClose();
      return { type: 'ready' };
    case 'render':
      return session.render(req.templateId, req.view, req.recordId, req.now);
  }
}

let queue = Promise.resolve();
scope.onmessage = (e) => {
  const req = e.data;
  // Spec 18 R8: a cancel is read now, while the archive it stops waits between records.
  if (req.type === 'cancel') {
    session.cancelRequested = true;
    return;
  }
  queue = queue.then(async () => {
    let body: ResBody;
    try {
      body = await handle(req);
    } catch (err) {
      body = { type: 'failed', error: toWireError(err) };
    }
    // An export's or a download's bytes are transferred, not copied (R12.4, spec 04 R8.1).
    const transfer =
      body.type === 'exported' || body.type === 'filledXml' || body.type === 'archived'
        ? [body.bytes]
        : [];
    scope.postMessage({ ...body, id: req.id }, transfer);
  });
};
