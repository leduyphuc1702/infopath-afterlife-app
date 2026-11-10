// Spec 09 R7.1, design D6, §7 (spec 12 R4.5 adds forms 43–47): the "Try a sample" set, copied from `samples/` at build time and
// never written back. Forms 01–08 with their records (the `-000-empty.xml` files left out: the
// pager starts with the template's own empty form) and theill's weight-keeper. Nothing else from
// `samples/` enters the bundle.
//
// `virtual:sample-list`: ids, file names and record counts, for the menu (main thread).
// `virtual:sample-files`: the bytes, imported lazily by the Worker. Templates are base64 (a .xsn
// is already compressed); records are kept as text when they are UTF-8, so gzip still works.
import { readdirSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

const SAMPLES_DIR = new URL('../../../samples/', import.meta.url);
const LIST = 'virtual:sample-list';
const FILES = 'virtual:sample-files';

export interface SampleFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}
export interface Sample {
  readonly id: string;
  /** Spec 12 R4.5: forms 43–47 are in "Triage all samples" only, without records. */
  readonly triageOnly?: true;
  readonly template: SampleFile;
  readonly records: readonly SampleFile[];
}

const read = (rel: string): SampleFile => ({
  name: rel.slice(rel.lastIndexOf('/') + 1),
  bytes: new Uint8Array(readFileSync(new URL(rel, SAMPLES_DIR))),
});

/** The bundled samples, in menu order. */
export function loadSamples(): Sample[] {
  const own = readdirSync(new URL('own/xsn/', SAMPLES_DIR))
    .filter((f) => /^0[1-8]-.*\.xsn$/.test(f))
    .sort()
    .map((f) => {
      const id = f.slice(0, -'.xsn'.length);
      const records = readdirSync(new URL(`own/records/${id}/`, SAMPLES_DIR))
        .filter((r) => r.endsWith('.xml') && !r.endsWith('-000-empty.xml'))
        .sort()
        .map((r) => read(`own/records/${id}/${r}`));
      return { id, template: read(`own/xsn/${f}`), records };
    });
  // Spec 12 R4.5: generated on 2026-11-10 and never opened in InfoPath (samples/own/README.md);
  // they carry code-behind, ActiveX, signatures and dead services. Templates only.
  const generated = readdirSync(new URL('own/xsn/', SAMPLES_DIR))
    .filter((f) => /^4[3-7]-.*\.xsn$/.test(f))
    .sort()
    .map((f): Sample => ({
      id: f.slice(0, -'.xsn'.length),
      triageOnly: true,
      template: read(`own/xsn/${f}`),
      records: [],
    }));
  const theill = {
    id: 'theill-weight-keeper',
    template: read('public/theill-weight-keeper/theill__weight-keeper.xsn'),
    records: [],
  };
  return [...own, theill, ...generated];
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
/** `[name, text]` when the bytes are UTF-8 that encodes back to the same bytes, else base64. */
function encode(f: SampleFile): [string, string, 't' | 'b'] {
  try {
    const text = utf8.decode(f.bytes);
    if (Buffer.from(text, 'utf8').equals(Buffer.from(f.bytes))) return [f.name, text, 't'];
  } catch {
    // not UTF-8: base64 below
  }
  return [f.name, Buffer.from(f.bytes).toString('base64'), 'b'];
}

export function samples(): Plugin {
  return {
    name: 'afterlife:samples',
    resolveId: (id) => (id === LIST || id === FILES ? `\0${id}` : null),
    load(id) {
      if (id === `\0${LIST}`) {
        const list = loadSamples().map((s) => ({
          id: s.id,
          fileName: s.template.name,
          records: s.records.length,
          ...(s.triageOnly && { triageOnly: true }),
        }));
        return `export default ${JSON.stringify(list)};`;
      }
      if (id === `\0${FILES}`) {
        const files = Object.fromEntries(
          loadSamples().map((s) => [
            s.id,
            { template: encode(s.template), records: s.records.map(encode) },
          ]),
        );
        return `export default ${JSON.stringify(files)};`;
      }
      return null;
    },
  };
}
