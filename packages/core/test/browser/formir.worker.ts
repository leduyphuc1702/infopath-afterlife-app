// Dedicated module Worker (spec 02 task 12, R13.1): parses one cabinet and builds its FormIR with
// core's public API, and replies with the serialised JSON, so the browser test compares it byte
// for byte with the Node golden file.
import {
  AfterlifeError,
  buildFormIR,
  parseXsn,
  serialiseFormIR,
  type ErrorCode,
} from '../../src/index';

export interface FormIRReply {
  json?: string;
  error?: { code?: string; message: string };
}

onmessage = (event: MessageEvent<Uint8Array>) => {
  parseXsn(event.data).then(
    (t) => postMessage({ json: serialiseFormIR(buildFormIR(t)) } satisfies FormIRReply),
    (e: unknown) =>
      postMessage({
        error:
          e instanceof AfterlifeError
            ? { code: (e as AfterlifeError<ErrorCode>).code, message: e.message }
            : { message: String(e) },
      } satisfies FormIRReply),
  );
};
