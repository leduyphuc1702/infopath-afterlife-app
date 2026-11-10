import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  CAUSE_IDS,
  CAUSES,
  causesOf,
  recordEvidence,
  MIXED_REPLACEMENT,
  WORKFLOW_LINE,
  type CauseId,
} from '../../src/index';
import { sampleIRs } from '../helpers/irs';
import { repoRoot } from '../helpers/samples';

// Spec 12 R2.1–R2.3, R6.2: each cause by its rule, only with evidence.
const samples = await sampleIRs();
const ids = (prefix: string) =>
  causesOf(samples.find((s) => s.slug.startsWith(prefix))!.ir).map((c) => c.id);
const formsWith = (id: CauseId) =>
  samples.filter((s) => causesOf(s.ir).some((c) => c.id === id)).map((s) => s.slug.slice(0, 2));

test('R2.1: which in-repo forms show each template cause', () => {
  expect(samples).toHaveLength(48);
  expect(formsWith('infopath-client')).toHaveLength(48);
  expect(formsWith('forms-services-spo')).toEqual(['43']);
  expect(formsWith('internal-sql')).toEqual(['04']);
  expect(formsWith('internal-service')).toEqual(['04', '46']);
  expect(formsWith('code-behind')).toEqual(['46', '47']);
  expect(formsWith('activex')).toEqual(['44']);
  expect(formsWith('signatures')).toEqual(['45']);
  expect(formsWith('browser-xslt')).toEqual([]);
});

test('form 04: SQL on sql-legacy01, the budget service on forms-legacy', () => {
  const cs = causesOf(samples.find((s) => s.slug.startsWith('04-'))!.ir);
  expect(cs.map((c) => c.id)).toEqual(['infopath-client', 'internal-sql', 'internal-service']);
  expect(cs[1]!.evidence.map((e) => e.what)).toEqual([
    'database connection Vendors to sql-legacy01',
  ]);
  expect(cs[2]!.evidence.map((e) => e.located.path.split('/').pop())).toEqual([
    '@wsdlUrl',
    '@serviceUrl',
  ]);
});

test('form 47: code-behind lists its script file and the events it handled', () => {
  const c = causesOf(samples.find((s) => s.slug.startsWith('47-'))!.ir).find(
    (x) => x.id === 'code-behind',
  )!;
  expect(c.evidence.map((e) => e.what)).toEqual([
    'code-behind in jscript',
    'code file script.js',
    'event msoxd_my_assetTag on /my:assetCheckoutScript/my:assetTag',
    'event msoxd_my_returnDue on /my:assetCheckoutScript/my:returnDue',
  ]);
  expect(c.replacement).toBe(
    'Manual: the logic must be rewritten by hand. The event names it handled are listed.',
  );
});

test("R2.3: form 05 has the client cause only; the certificate line is the brief's", () => {
  expect(ids('05-')).toEqual(['infopath-client']);
  expect(WORKFLOW_LINE).toBe(
    'Workflows attached outside the form cannot be detected from the file. Ask the library owner.',
  );
});

test('R2.2: exactly three causes carry a date and a source, as checked on 2026-11-11', () => {
  const dated = CAUSE_IDS.filter((id) => CAUSES[id].date !== undefined);
  expect(dated.map((id) => [id, CAUSES[id].date, CAUSES[id].source?.url])).toEqual([
    [
      'forms-services-spo',
      '2026-07-14',
      'https://techcommunity.microsoft.com/t5/microsoft-sharepoint-blog/support-update-for-infopath-forms-services-in-microsoft-365/ba-p/3858190',
    ],
    [
      'infopath-client',
      '2026-07-14',
      'https://learn.microsoft.com/en-us/lifecycle/products/infopath-2013',
    ],
    [
      'browser-xslt',
      '2026-11-17',
      'https://developer.chrome.com/docs/web-platform/deprecating-xslt',
    ],
  ]);
  for (const id of CAUSE_IDS) {
    expect(CAUSES[id].replacement, id).not.toBe('');
    if (CAUSES[id].date === undefined) {
      expect(CAUSES[id].dateWords, id).toBe('—');
      expect(CAUSES[id].source, id).toBeUndefined();
    }
  }
  // Decision 2: Manual is never shown next to "Unsupported".
  expect(CAUSES['code-behind'].replacement).not.toContain('Unsupported');
  expect(CAUSES.activex.replacement).toMatch(/^Unsupported/);
});

test('R6.2: browser-xslt from a record with an xml-stylesheet instruction, none of the 348', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = `${repoRoot}samples/own/records/`;
  let n = 0;
  for (const slug of readdirSync(dir))
    for (const f of readdirSync(`${dir}${slug}`).filter((x) => !x.endsWith('-000-empty.xml'))) {
      n++;
      expect(recordEvidence(f, readFileSync(`${dir}${slug}/${f}`)).stylesheet, f).toBeUndefined();
    }
  expect(n).toBe(348);
  const xml = new TextEncoder().encode(
    '<?xml version="1.0"?>\n<?mso-infoPathSolution name="urn:x"?>\n<?xml-stylesheet type="text/xsl" href="view.xsl"?>\n<my:r xmlns:my="urn:my"/>',
  );
  const r = recordEvidence('old-001.xml', xml);
  expect(r.stylesheet).toMatchObject({ file: 'old-001.xml', line: 3, column: 1 });
  const cs = causesOf(samples[0]!.ir, [r, recordEvidence('plain.xml', new Uint8Array())]);
  const x = cs.find((c) => c.id === 'browser-xslt')!;
  expect(x.from).toBe('record');
  expect(x.evidence).toHaveLength(1);
  // Past the 4 KB window it is not seen, as matchRecord's window.
  const late = new TextEncoder().encode(
    `<?xml version="1.0"?>${' '.repeat(4100)}<?xml-stylesheet href="x"?>`,
  );
  expect(recordEvidence('late.xml', late).stylesheet).toBeUndefined();
});

test('every cause has evidence', () => {
  for (const { slug, ir } of samples)
    for (const c of causesOf(ir)) expect(c.evidence.length, `${slug} ${c.id}`).toBeGreaterThan(0);
});

// Review 2026-11-11: the replacement follows the class of the element the evidence comes from.
test("form 46's internal host is a Native submit (davAdapter): the JSM request takes its place", () => {
  const cs = causesOf(samples.find((s) => s.slug.startsWith('46-'))!.ir);
  const svc = cs.find((c) => c.id === 'internal-service')!;
  expect(svc.replacement).toBe('The JSM request takes its place');
  expect(svc.evidence[0]!.what).toContain('davAdapter, submit');
  const sql = causesOf(samples.find((s) => s.slug.startsWith('04-'))!.ir).find(
    (c) => c.id === 'internal-service',
  )!;
  expect(sql.replacement).toBe('Manual: rebind or replace with a JSM field');
});

test('a query and a submit to internal hosts: each piece says what replaces it', () => {
  const f04 = samples.find((s) => s.slug.startsWith('04-'))!.ir;
  const f46 = samples.find((s) => s.slug.startsWith('46-'))!.ir;
  const ir = { ...f04, dataConnections: [...f04.dataConnections, ...f46.dataConnections] };
  const svc = causesOf(ir).find((c) => c.id === 'internal-service')!;
  expect(svc.replacement).toBe(MIXED_REPLACEMENT);
  expect(new Set(svc.evidence.map((e) => e.replacement))).toEqual(
    new Set(['Manual: rebind or replace with a JSM field', 'The JSM request takes its place']),
  );
});

test('every replacement agrees with its class: ActiveX Unsupported, signatures and code Manual', () => {
  expect(CAUSES.activex.replacement).toBe(
    "Unsupported: nothing replaces it. The control's class ID is listed so someone can find what it did.",
  );
  expect(CAUSES.signatures.replacement).toMatch(/^Manual: /);
  expect(CAUSES['code-behind'].replacement).toMatch(/^Manual: /);
  expect(CAUSES['internal-sql'].replacement).toMatch(/^Manual: /);
  expect(CAUSES['infopath-client'].dateWords).toBe('July 14, 2026 (last day of extended support)');
  for (const id of CAUSE_IDS) expect(CAUSES[id].dateWords, id).not.toMatch(/AM|PM/);
});
