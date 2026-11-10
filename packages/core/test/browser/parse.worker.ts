// Dedicated module Worker (task 24, R17.3): parses one cabinet with core's public API and replies
// with the snapshot form used by the golden files, so the browser test compares it with them.
import { AfterlifeError, parseXsn, type ErrorCode } from '../../src/index';
import { snapshot, type Snapshot } from '../helpers/snapshot';

export interface ParseReply {
  snap?: Snapshot;
  error?: { code?: string; message: string };
}

async function parse(bytes: Uint8Array): Promise<ParseReply> {
  return { snap: await snapshot(await parseXsn(bytes)) };
}

onmessage = (event: MessageEvent<Uint8Array>) => {
  parse(event.data).then(
    (reply) => postMessage(reply),
    (e: unknown) => postMessage(failure(e)),
  );
};

function failure(e: unknown): ParseReply {
  if (!(e instanceof AfterlifeError)) return { error: { message: String(e) } };
  const err = e as AfterlifeError<ErrorCode>;
  return { error: { code: err.code, message: err.message } };
}
