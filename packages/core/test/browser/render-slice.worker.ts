// Dedicated module Worker (spec 03 task 4): renders one view of one cabinet with the golden input
// through core's public API, and replies with the golden file text, so the browser test compares
// it byte for byte with the Node golden.
import { buildFormIR, parseXsn, prepareView, renderView } from '../../src/index';
import { GOLDEN_INPUT } from '../helpers/render-golden';
import { goldenText, snapshot } from '../helpers/snapshot';

export interface SliceRequest {
  readonly xsn: Uint8Array;
  readonly record: Uint8Array;
  readonly view: string;
}

export interface SliceReply {
  text?: string;
  error?: string;
}

onmessage = (event: MessageEvent<SliceRequest>) => {
  const { xsn, record, view } = event.data;
  (async () => {
    const t = await parseXsn(xsn);
    const result = renderView(await prepareView(t, buildFormIR(t), { view }), {
      ...GOLDEN_INPUT,
      record,
    });
    return goldenText(await snapshot(result));
  })().then(
    (text) => postMessage({ text } satisfies SliceReply),
    (e: unknown) => postMessage({ error: String(e) } satisfies SliceReply),
  );
};
