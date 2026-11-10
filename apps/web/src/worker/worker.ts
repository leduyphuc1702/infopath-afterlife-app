// Spec 09 design §1, §4: the Worker entry. One session per Worker; requests are answered in order.
import samples from './samples';
import type { Req, Res, ResBody } from './protocol';
import { Session, toWireError } from './session';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage(message: Res): void;
};
const session = new Session();

async function handle(req: Req): Promise<ResBody> {
  switch (req.type) {
    case 'warm':
      await samples();
      return { type: 'ready' };
    case 'open':
      return session.open(req.files);
    case 'openSample':
      return session.open(await samples(req.sample));
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
    scope.postMessage({ ...body, id: req.id });
  });
};
