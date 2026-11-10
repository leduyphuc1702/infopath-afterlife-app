import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { countTemplate, parseXsn } from '../src/index';
import { readmeTable } from './oracles/readme-table';
import { readSample, repoRoot, sampleCabinets } from './helpers/samples';

// R16.1–R16.3: countTemplate equals every README row, read from the README itself.

const rows = readmeTable();
const own = sampleCabinets().filter((c) => c.slug !== 'theill-weight-keeper');
const xsnSlugs = readdirSync(`${repoRoot}samples/own/xsn/`)
  .filter((n) => n.endsWith('.xsn'))
  .map((n) => n.slice(0, -'.xsn'.length));

test('every README row has an .xsn and every .xsn has a row', () => {
  expect(rows.map((r) => r.slug).sort()).toEqual([...xsnSlugs].sort());
});

test.each(rows.map((r) => [r.slug, r] as const))('%s', async (slug, row) => {
  const cab = own.find((c) => c.slug === slug)!;
  const c = countTemplate(await parseXsn(readSample(cab.path)));
  expect({
    Views: c.views,
    Fields: c.fields,
    Rules: c.rules,
    Calcs: c.calcs,
    Checks: c.checks,
    'Repeating/optional': c.repeatingOrOptional,
  }).toEqual(row.counts);
});

test('form 44: Repeating/optional is 1 from the schema, while the manifest has no xCollection/xOptional editWith', async () => {
  const cab = own.find((c) => c.slug === '44-contract-approval-task')!;
  const t = await parseXsn(readSample(cab.path));
  const editWith = t.manifest.views
    .flatMap((v) => v.xmlToEdit)
    .map((x) => x.editWith?.attrs.component);
  expect(editWith.filter((c) => c === 'xCollection' || c === 'xOptional')).toEqual([]);
  const manifest = readFileSync(`${cab.formsDir!}manifest.xsf`, 'utf8');
  expect(manifest).not.toMatch(/component="x(Collection|Optional)"/);
  expect(countTemplate(t).repeatingOrOptional).toBe(1);
});

test('the public sample: Views 1, Fields 5, Rules 0, Calcs 1, Checks 0, Repeating/optional 4', async () => {
  const cab = sampleCabinets().find((c) => c.slug === 'theill-weight-keeper')!;
  expect(countTemplate(await parseXsn(readSample(cab.path)))).toEqual({
    views: 1,
    fields: 5,
    rules: 0,
    calcs: 1,
    checks: 0,
    repeatingOrOptional: 4,
  });
});
