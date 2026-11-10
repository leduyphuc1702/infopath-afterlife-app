// Dedicated module Worker (spec 03 task 13, R9.1): times renderView for every view of one cabinet
// with its empty and first records: 2 warm-ups, then 20 timed renders each, the view prepared
// once before timing. Replies with the sorted times per view and record.
import { buildFormIR, parseXsn, prepareView, renderView } from '../../src/index';
import { GOLDEN_INPUT } from '../helpers/render-golden';

export interface PerfRequest {
  readonly slug: string;
  readonly xsn: Uint8Array;
  readonly records?: { readonly empty: Uint8Array; readonly first: Uint8Array };
}

export interface PerfReply {
  /** `<slug>/<view file> <empty|first>` → the 20 times in ms, ascending. */
  times?: Record<string, number[]>;
  error?: string;
}

const WARM_UP = 2;
const RUNS = 20;

onmessage = (event: MessageEvent<PerfRequest>) => {
  const { slug, xsn, records } = event.data;
  (async () => {
    const t = await parseXsn(xsn);
    const byName = new Map(t.files.map((f) => [f.name.toLowerCase(), f.bytes]));
    const recs = records ?? {
      empty: byName.get('template.xml')!,
      first: byName.get('sampledata.xml')!,
    };
    const ir = buildFormIR(t);
    const out: Record<string, number[]> = {};
    for (const v of t.manifest.views) {
      const xslFile = v.mainpanes[0]?.attrs.transform;
      if (xslFile === undefined) continue;
      const prepared = await prepareView(t, ir, { view: v.attrs.name ?? xslFile });
      for (const record of ['empty', 'first'] as const) {
        const input = { ...GOLDEN_INPUT, record: recs[record] };
        for (let i = 0; i < WARM_UP; i++) renderView(prepared, input);
        const times: number[] = [];
        for (let i = 0; i < RUNS; i++) {
          const t0 = performance.now();
          renderView(prepared, input);
          times.push(performance.now() - t0);
        }
        out[`${slug}/${xslFile} ${record}`] = times.sort((a, b) => a - b);
      }
    }
    return out;
  })().then(
    (times) => postMessage({ times } satisfies PerfReply),
    (e: unknown) => postMessage({ error: String(e) } satisfies PerfReply),
  );
};
