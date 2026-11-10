import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildFormIR, parsePackage, serialiseFormIR, type FormIR } from '../../src/index';
import { buildConnections } from '../../src/ir/connections';
import { IdRegistry } from '../../src/ir/ids';
import { sampleTemplates } from '../helpers/formir';
import { packageFile } from '../helpers/package';

// Spec 02 R8.1–R8.4.

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
const form = (n: number) => samples.find((s) => s.form === n)!.ir;
const fixture = (name: string): FormIR =>
  buildFormIR(
    parsePackage([
      packageFile(
        'manifest.xsf',
        readFileSync(new URL(`../fixtures/synthetic/${name}`, import.meta.url)),
      ),
    ]),
  );
const summary = (ir: FormIR) =>
  ir.dataConnections.map((c) => ({
    kind: c.adapterKind,
    q: c.isQuery,
    s: c.isSubmit,
    ds: c.dataSource,
    ep: c.endpoints.map((e) => [e.attribute, e.host, e.liveness, e.reason]),
  }));

describe('R8.1 connections', () => {
  test('form 04: an ADO and a web-service query, in document order', () => {
    expect(summary(form(4))).toEqual([
      {
        kind: 'adoAdapter',
        q: true,
        s: false,
        ds: 'Vendors',
        ep: [['connectionString', 'sql-legacy01', 'internal', 'singleLabel']],
      },
      {
        kind: 'webServiceAdapter',
        q: true,
        s: false,
        ds: 'BudgetService',
        ep: [
          ['wsdlUrl', 'forms-legacy', 'internal', 'singleLabel'],
          ['serviceUrl', 'forms-legacy', 'internal', 'singleLabel'],
        ],
      },
    ]);
    expect(form(4).dataConnections[1]!.children.map((c) => c.kind)).toEqual(['operation', 'input']);
  });

  test.each([1, 2, 7])('form %i: one e-mail submit with no endpoint', (n) => {
    expect(summary(form(n))).toEqual([
      { kind: 'emailAdapter', q: false, s: true, ds: undefined, ep: [] },
    ]);
  });

  test('form 03: the XML file is a package file', () => {
    expect(summary(form(3))[0]!.ep).toEqual([['fileUrl', undefined, 'package', 'packageFile']]);
  });

  test('form 44 submits to the host; form 46 to a DAV folder on a single-label host', () => {
    expect(summary(form(44))).toEqual([
      { kind: 'submitToHostAdapter', q: false, s: true, ds: undefined, ep: [] },
    ]);
    expect(summary(form(46))[0]!.ep).toEqual([
      ['folderURL', 'forms-legacy', 'internal', 'singleLabel'],
    ]);
  });

  test('submit values with valueType="expression" wait for stage 7', () => {
    const s = samples.find((x) => x.form === 46)!;
    const pending = buildConnections(s.t, new IdRegistry()).pending;
    expect(pending.map((p) => [p.role, p.text])).toEqual([
      ['submitValue', 'concat(my:vendorName, "-", my:taxId)'],
    ]);
    const s1 = samples.find((x) => x.form === 1)!;
    expect(buildConnections(s1.t, new IdRegistry()).pending.map((p) => p.text)).toEqual([
      'my:managerEmail',
    ]);
  });

  test('every sample: credentialRedacted false', () => {
    expect(samples.flatMap((s) => s.ir.dataConnections).some((c) => c.credentialRedacted)).toBe(
      false,
    );
  });
});

describe('R8.2–R8.3 publishUrl and synthetic adapters', () => {
  test('46 publishUrls are file paths; forms 43 and 44 are public', () => {
    const eps = samples.map((s) => [s.form, s.ir.meta.publishEndpoint!] as const);
    expect(eps.filter(([, e]) => e.reason === 'filePath')).toHaveLength(46);
    expect(eps.filter(([, e]) => e.liveness !== 'internal').map(([f, e]) => [f, e.reason])).toEqual(
      [
        [43, 'public'],
        [44, 'public'],
      ],
    );
  });

  test('SharePoint list adapters give their site hosts', () => {
    const ir = fixture('sharepoint-adapters.xsf');
    const eps = ir.dataConnections.flatMap((c) =>
      c.endpoints.map((e) => [c.adapterKind, e.attribute]),
    );
    expect(eps).toEqual(
      expect.arrayContaining([
        ['sharepointListAdapter', 'siteUrl'],
        ['sharepointListAdapterRW', 'siteURL'],
      ]),
    );
  });

  test('a connectoid gives its .udcx source as an endpoint', () => {
    const ir = fixture('connectoid.xsf');
    expect(ir.dataConnections.flatMap((c) => c.endpoints).map((e) => e.attribute)).toContain(
      'source',
    );
  });
});

describe('R8.4 the secret appears nowhere in FormIR', () => {
  test('connectoid.xsf: Password=fictional is redacted everywhere', () => {
    const ir = fixture('connectoid.xsf');
    const json = serialiseFormIR(ir);
    expect(json).not.toContain('fictional');
    const ado = ir.dataConnections.find((c) => c.adapterKind === 'adoAdapter')!;
    expect(ado.credentialRedacted).toBe(true);
    expect(ado.attrs.connectionString).toContain('Password=***');
    expect(ado.endpoints[0]!.value).toContain('Password=***');
  });

  test('a secret in an adapter child, a connectoid and the adapter attrs never reaches the JSON', () => {
    const xml = `<?xml version="1.0"?>
<xsf:xDocumentClass solutionFormatVersion="3.0.0.0" xmlns:xsf="http://schemas.microsoft.com/office/infopath/2003/solutionDefinition" xmlns:xsf2="http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions">
<xsf:dataObjects><xsf:dataObject name="Rooms" schema="Rooms.xsd" initOnLoad="no"><xsf:query>
<xsf:adoAdapter name="Rooms" connectionString="Data Source=sql-legacy01;User ID=forms;Pwd=Hunter-2-zz" commandText="select 1" queryAllowed="yes" submitAllowed="no"/>
</xsf:query></xsf:dataObject></xsf:dataObjects>
<xsf:submit><xsf:webServiceAdapter name="Book" wsdlUrl="http://forms-legacy/b.asmx?WSDL;Password=Hunter-2-zz" submitAllowed="yes"><xsf:operation name="Book" serviceUrl="http://forms-legacy/b.asmx;pwd=Hunter-2-zz" soapAction="urn:book"/></xsf:webServiceAdapter></xsf:submit>
<xsf:extensions><xsf:extension name="SolutionDefinitionExtensions"><xsf2:solutionDefinition><xsf2:dataConnections>
<xsf2:adoAdapterExtension ref="Rooms"><xsf2:connectoid name="Rooms" source="http://forms-legacy/dc/rooms.udcx;Password=Hunter-2-zz"/></xsf2:adoAdapterExtension>
</xsf2:dataConnections></xsf2:solutionDefinition></xsf:extension></xsf:extensions>
</xsf:xDocumentClass>`;
    const t = parsePackage([packageFile('manifest.xsf', xml)]);
    expect(t.unknowns).toEqual([]);
    const ir = buildFormIR(t);
    expect(serialiseFormIR(ir)).not.toContain('Hunter-2-zz');
    expect(ir.dataConnections.map((c) => c.credentialRedacted)).toEqual([true, true]);
    expect(ir.dataConnections.flatMap((c) => c.endpoints)).toHaveLength(4);
  });
});
