import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { distAssets, readDist } from './dist';

// R7.1: the samples in `dist` are forms 01–08 with their 153 records and weight-keeper, byte for
// byte; no `-000-empty.xml` and no other file from `samples/`.
const SAMPLES = new URL('../../../samples/', import.meta.url);

type Encoded = readonly [string, string, 't' | 'b'];
const decode = ([, content, kind]: Encoded) =>
  kind === 't' ? Buffer.from(content, 'utf8') : Buffer.from(content, 'base64');

async function bundled(): Promise<Record<string, { template: Encoded; records: Encoded[] }>> {
  const file = distAssets().find((f) => /^_virtual_sample-files-.*\.js$/.test(f));
  expect(file).toBeDefined();
  const url = `data:text/javascript;base64,${readDist(`assets/${file}`).toString('base64')}`;
  return ((await import(/* @vite-ignore */ url)) as { default: never }).default;
}

test('9 templates and 153 records, names and bytes equal to the sources', async () => {
  const files = await bundled();
  const ids = Object.keys(files);
  expect(ids).toHaveLength(9);
  let records = 0;
  for (const id of ids) {
    const s = files[id]!;
    const src =
      id === 'theill-weight-keeper'
        ? new URL('public/theill-weight-keeper/', SAMPLES)
        : new URL('own/', SAMPLES);
    const xsn = id === 'theill-weight-keeper' ? 'theill__weight-keeper.xsn' : `xsn/${id}.xsn`;
    expect(s.template[0], id).toBe(xsn.slice(xsn.lastIndexOf('/') + 1));
    expect(decode(s.template).equals(readFileSync(new URL(xsn, src))), id).toBe(true);
    const want =
      id === 'theill-weight-keeper'
        ? []
        : readdirSync(new URL(`records/${id}/`, src))
            .filter((f) => f.endsWith('.xml') && !f.endsWith('-000-empty.xml'))
            .sort();
    expect(
      s.records.map((r) => r[0]),
      id,
    ).toEqual(want);
    for (const r of s.records)
      expect(decode(r).equals(readFileSync(new URL(`records/${id}/${r[0]}`, src))), r[0]).toBe(
        true,
      );
    records += s.records.length;
  }
  expect(records).toBe(153);
});

test('no other sample file is in dist', () => {
  const names = [
    ...readdirSync(new URL('own/', SAMPLES), { recursive: true }),
    ...readdirSync(new URL('public/', SAMPLES), { recursive: true }),
  ]
    .map(String)
    .map((p) => p.slice(p.lastIndexOf('/') + 1))
    .filter((n) => /\.(xsn|xml|xsl|xsd|xsf|png|txt)$/i.test(n));
  const dist = readdirSync(new URL('../dist/', import.meta.url), { recursive: true }).map(String);
  // File names only: a sample file copied into dist would keep its name.
  const leaked = dist.filter((p) => names.includes(p.slice(p.lastIndexOf('/') + 1)));
  expect(leaked).toEqual([]);
  // The empty records are not inside the samples chunk either.
  const chunk = distAssets().find((f) => f.startsWith('_virtual_sample-files-'))!;
  expect(readDist(`assets/${chunk}`).toString('utf8')).not.toContain('-000-empty.xml');
});
