import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  buildFormIR,
  downloadedXml,
  FillSession,
  matchRecord,
  parseXsn,
  type TemplateKey,
} from '../../src/index';
import { writeCabinet } from '../helpers/cab-writer';
import { compareVersions } from '../../src/xsn/match';

// Spec 09 R2.1, R2.2. Forms 01 and 07 share one URN, with versions 1.0.0.1 and 1.0.0.2; every
// one of their 31 and 11 record files says so (checked 2026-11-11).
const own = new URL('../../../../samples/own/', import.meta.url);
const keyOf = async (slug: string): Promise<TemplateKey> => {
  const { meta } = buildFormIR(await parseXsn(readFileSync(new URL(`xsn/${slug}.xsn`, own))));
  return {
    ...(meta.urn && { urn: meta.urn }),
    ...(meta.solutionVersion && { version: meta.solutionVersion }),
  };
};
const records = (slug: string) =>
  readdirSync(new URL(`records/${slug}/`, own))
    .filter((f) => !f.endsWith('-000-empty.xml'))
    .map((f) => readFileSync(new URL(`records/${slug}/${f}`, own)));
const xml = (s: string) => new TextEncoder().encode(s);

const v1 = await keyOf('01-leave-request');
const v2 = await keyOf('07-leave-request-v2');

test('forms 01 and 07: one URN, two versions', () => {
  expect(v1.urn).toBe(v2.urn);
  expect([v1.version, v2.version]).toEqual(['1.0.0.1', '1.0.0.2']);
});

describe('with both templates open', () => {
  test("01's 30 records go to 01 and 07's 10 to 07, exactly", () => {
    const keys = [v2, v1];
    expect(records('01-leave-request').map((r) => matchRecord(r, keys))).toEqual(
      Array(30).fill({ kind: 'exact', template: 1 }),
    );
    expect(records('07-leave-request-v2').map((r) => matchRecord(r, keys))).toEqual(
      Array(10).fill({ kind: 'exact', template: 0 }),
    );
  });
});

test("with 07 alone, 01's 30 records match it as another version", () => {
  for (const r of records('01-leave-request'))
    expect(matchRecord(r, [v2])).toEqual({
      kind: 'otherVersion',
      template: 0,
      recordVersion: '1.0.0.1',
    });
});

test('records with no instruction, or for a template not open, are unmatched with a reason', () => {
  expect(matchRecord(xml('<?xml version="1.0"?><a/>'), [v1])).toEqual({
    kind: 'unmatched',
    reason: 'noSolution',
  });
  const [first] = records('02-expense-report');
  expect(matchRecord(first!, [v1, v2])).toEqual({
    kind: 'unmatched',
    reason: 'noTemplate',
    urn: 'urn:schemas-microsoft-com:office:infopath:Expense-Claim:-myXSD-2026-11-03T08-10-00',
  });
  expect(matchRecord(first!, [])).toMatchObject({ reason: 'noTemplate' });
});

test('another version: the highest not above the record, else the lowest above it', () => {
  const pi = (v: string) => xml(`<?mso-infoPathSolution name="u" solutionVersion="${v}"?><a/>`);
  const keys = ['1.0.0.9', '1.0.0.10', '2.0', '0.9'].map((version) => ({ urn: 'u', version }));
  expect(matchRecord(pi('1.5'), keys)).toMatchObject({ template: 1 }); // 1.0.0.10
  expect(matchRecord(pi('0.1'), keys)).toMatchObject({ template: 3 }); // 0.9
  expect(matchRecord(pi('9'), keys)).toMatchObject({ template: 2 }); // 2.0
});

test('a missing version on either side counts as equal', () => {
  const noVersion = xml('<?mso-infoPathSolution name="u"?><a/>');
  expect(matchRecord(noVersion, [{ urn: 'u', version: '1' }])).toEqual({
    kind: 'exact',
    template: 0,
  });
  const withVersion = xml('<?mso-infoPathSolution name="u" solutionVersion="3"?><a/>');
  expect(matchRecord(withVersion, [{ urn: 'u' }])).toEqual({ kind: 'exact', template: 0 });
});

test('versions order numerically, part by part', () => {
  expect(['1.0.0.10', '1.0.0.9', '1.0', '1', '1.0.0.1'].sort(compareVersions)).toEqual([
    '1',
    '1.0',
    '1.0.0.1',
    '1.0.0.9',
    '1.0.0.10',
  ]);
});

// Spec 24 W3: a template without a form ID (`xDocumentClass` has no `name`) still makes records
// that open with it: the record's `href` is matched against the template's `publishUrl`.
describe('spec 24 W3: no form ID', () => {
  const pi = (attrs: string) =>
    new TextEncoder().encode(`<?xml version="1.0"?>\n<?mso-infoPathSolution ${attrs} ?>\n<my:f/>`);
  test('href against publishUrl, as InfoPath wrote them', () => {
    const r = pi(
      'solutionVersion="1.0.0.3" href="file:///C:/Forms/Task%20form.xsn" productVersion="15.0.0" PIVersion="1.0.0.0"',
    );
    expect(
      matchRecord(r, [{ urn: 'urn:other' }, { publishUrl: 'c:\\forms\\Task form.xsn' }]),
    ).toEqual({
      kind: 'exact',
      template: 1,
    });
    expect(matchRecord(r, [{ publishUrl: 'C:\\forms\\other.xsn' }]).kind).toBe('unmatched');
  });

  test('a record filled from such a template and downloaded opens with it', async () => {
    const dir = new URL('../../../../samples/own/forms/01-leave-request/', import.meta.url);
    const strip = (s: string) => s.replace(/\sname="urn:[^"]*"/, '');
    const files = readdirSync(dir).map((name) => {
      const raw = readFileSync(new URL(name, dir));
      const text =
        name === 'manifest.xsf' || name === 'template.xml'
          ? strip(raw.toString('utf8'))
          : undefined;
      return {
        name,
        bytes: text === undefined ? new Uint8Array(raw) : new TextEncoder().encode(text),
      };
    });
    const t = await parseXsn(writeCabinet(files).bytes);
    const ir = buildFormIR(t);
    expect(ir.meta.urn).toBeUndefined();
    const s = FillSession.open(t, ir, { now: '2026-11-11T09:00:00+07:00' });
    s.edit(s.paths(ir.fields.find((f) => f.name === 'employeeName')!.id)[0]!, 'Zeta');
    const record = new TextEncoder().encode(downloadedXml(s.xml(), ir.meta.publishUrl));
    expect(matchRecord(record, [{ publishUrl: ir.meta.publishUrl! }])).toEqual({
      kind: 'exact',
      template: 0,
    });
  });
});
