import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { buildFormIR, parseXsn, prepareView, renderView, type PreparedView } from '../../src/index';
import { readSample, repoRoot, sampleCabinets } from '../helpers/samples';

// Spec 03 R2.1: a record made with another template version renders, with one
// RECORD_TEMPLATE_MISMATCH naming both. Task 6 adds R2.2 (secondary data).

const NOW = '2026-11-03T09:00:00-08:00';
const records = `${repoRoot}samples/own/records/`;
const read = (path: string) => new Uint8Array(readFileSync(path));

const prepared = new Map<string, PreparedView>();
beforeAll(async () => {
  for (const c of sampleCabinets()) {
    const t = await parseXsn(readSample(c.path));
    prepared.set(c.slug, await prepareView(t, buildFormIR(t)));
  }
});

const mismatches = (slug: string, record: Uint8Array) =>
  renderView(prepared.get(slug)!, { now: NOW, record }).issues.filter(
    (i) => i.code === 'RECORD_TEMPLATE_MISMATCH',
  );

test('a form 01 record rendered with form 07 (same URN, version 1.0.0.1 against 1.0.0.2) gives one issue', () => {
  const issues = mismatches(
    '07-leave-request-v2',
    read(`${records}01-leave-request/01-leave-request-001.xml`),
  );
  const urn = 'urn:schemas-microsoft-com:office:infopath:Leave-Request:-myXSD-2026-11-03T08-00-00';
  expect(issues).toEqual([
    {
      code: 'RECORD_TEMPLATE_MISMATCH',
      message: `record.xml: made with ${urn} version 1.0.0.1; rendered with ${urn} version 1.0.0.2`,
      file: 'record.xml',
      details: {
        recordUrn: urn,
        recordVersion: '1.0.0.1',
        templateUrn: urn,
        templateVersion: '1.0.0.2',
      },
    },
  ]);
});

test('a record of another form names both URNs', () => {
  const [issue] = mismatches(
    '02-expense-report',
    read(`${records}01-leave-request/01-leave-request-001.xml`),
  );
  expect(issue?.details?.recordUrn).toMatch(/Leave-Request/);
  expect(issue?.details?.templateUrn).not.toBe(issue?.details?.recordUrn);
});

test('every own record, with its own template, gives none (395 records)', () => {
  let count = 0;
  for (const slug of readdirSync(records).sort()) {
    for (const name of readdirSync(`${records}${slug}`)
      .filter((n) => n.endsWith('.xml'))
      .sort()) {
      expect(mismatches(slug, read(`${records}${slug}/${name}`)), name).toEqual([]);
      count++;
    }
  }
  expect(count).toBe(395);
});

test('a record with no mso-infoPathSolution names nothing, so it gives none', () => {
  const plain = new TextEncoder().encode(
    '<my:leaveRequest xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:00:00"/>',
  );
  expect(mismatches('01-leave-request', plain)).toEqual([]);
});
