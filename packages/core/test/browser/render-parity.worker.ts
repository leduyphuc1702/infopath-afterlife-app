// Dedicated module Worker (spec 03 task 9, R5.3): renders every view of one cabinet with its
// empty and first records and the golden input, through core's public API, and replies with the
// golden file text of each render. `fetch` throws and is counted, so a render that reached the
// network would fail here (design §10, Worker parity).
import { buildFormIR, parseXsn, prepareView, renderView } from '../../src/index';
import { GOLDEN_INPUT, renderGoldenPath } from '../helpers/render-golden';
import { goldenText, snapshot } from '../helpers/snapshot';

export interface ParityRequest {
  readonly slug: string;
  readonly xsn: Uint8Array;
  /** Our forms' records; absent for the public sample, whose records are in its package. */
  readonly records?: { readonly empty: Uint8Array; readonly first: Uint8Array };
}

export interface ParityReply {
  /** Golden path (relative to `test/`) → golden file text. */
  files?: Record<string, string>;
  fetchCalls?: number;
  error?: string;
}

let fetchCalls = 0;
globalThis.fetch = () => {
  fetchCalls++;
  throw new Error('fetch is not allowed in a render');
};

onmessage = (event: MessageEvent<ParityRequest>) => {
  const { slug, xsn, records } = event.data;
  (async () => {
    const t = await parseXsn(xsn);
    const byName = new Map(t.files.map((f) => [f.name.toLowerCase(), f.bytes]));
    const recs = records ?? {
      empty: byName.get('template.xml')!,
      first: byName.get('sampledata.xml')!,
    };
    const ir = buildFormIR(t);
    const files: Record<string, string> = {};
    for (const v of t.manifest.views) {
      const xslFile = v.mainpanes[0]?.attrs.transform;
      if (xslFile === undefined) continue;
      const prepared = await prepareView(t, ir, { view: v.attrs.name ?? xslFile });
      for (const record of ['empty', 'first'] as const) {
        const result = renderView(prepared, { ...GOLDEN_INPUT, record: recs[record] });
        files[renderGoldenPath(slug, xslFile, record)] = goldenText(await snapshot(result));
      }
    }
    return files;
  })().then(
    (files) => postMessage({ files, fetchCalls } satisfies ParityReply),
    (e: unknown) => postMessage({ error: String(e), fetchCalls } satisfies ParityReply),
  );
};
