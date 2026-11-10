import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Adapter, Manifest } from '../../src/xsf/types';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { formNumber, sampleManifests } from '../helpers/manifests';
import { manifestBytes } from '../helpers/synthetic-manifest';

// R11.1–R11.5, R11.7: data objects, main query, submit, data adapters, xsf2 data connections.

const manifests = await sampleManifests();
const all = manifests.map((m) => [m.slug, parseManifest(m.bytes).manifest] as const);
const form = (n: number): Manifest =>
  all.find(([slug]) => !slug.startsWith('theill') && formNumber(slug) === n)![1];

const fixture = (name: string) =>
  parseManifest(
    new Uint8Array(readFileSync(new URL(`../fixtures/synthetic/${name}`, import.meta.url))),
  );

const childKeys = (a: Adapter) => a.children.map((c) => c.key);

describe('R11.7 oracle', () => {
  test('form 04: an adoAdapter at sql-legacy01 and a webServiceAdapter at forms-legacy', () => {
    const [vendors, budget] = form(4).dataObjects;
    expect(vendors!.attrs).toEqual({ name: 'Vendors', schema: 'Vendors.xsd', initOnLoad: 'no' });
    const ado = vendors!.query!;
    expect(ado).toMatchObject({ key: 'xsf:adoAdapter', role: 'query', containsCredential: false });
    expect(ado.attrs).toMatchObject({ queryAllowed: 'yes', submitAllowed: 'no' });
    expect((ado.attrs as { connectionString: string }).connectionString).toContain(
      'Data Source=sql-legacy01;',
    );
    const ws = budget!.query!;
    expect(ws.key).toBe('xsf:webServiceAdapter');
    expect(ws.attrs).toEqual({
      wsdlUrl: 'http://forms-legacy/budget/BudgetService.asmx?WSDL',
      queryAllowed: 'yes',
      submitAllowed: 'no',
      name: 'BudgetService',
    });
    expect(ws.children.map((c) => [c.key, c.attrs])).toEqual([
      [
        'xsf:operation',
        {
          name: 'GetRemainingBudget',
          soapAction: 'http://forms-legacy/budget/GetRemainingBudget',
          serviceUrl: 'http://forms-legacy/budget/BudgetService.asmx',
        },
      ],
      ['xsf:input', { source: 'BudgetServiceInput.xml' }],
    ]);
  });

  test('form 03: xmlFileAdapter fileUrl="locations.xml"', () => {
    const [locations] = form(3).dataObjects;
    expect(locations!.query).toMatchObject({
      key: 'xsf:xmlFileAdapter',
      role: 'query',
      attrs: { fileUrl: 'locations.xml' },
      children: [],
    });
  });

  test.each([1, 2, 7])('form %i submits through emailAdapter, linked to its extension', (n) => {
    const m = form(n);
    const [email] = m.submit!.adapters;
    expect(m.submit!.adapters).toHaveLength(1);
    expect(email).toMatchObject({ key: 'xsf:emailAdapter', role: 'submit' });
    expect(childKeys(email!)).toEqual([
      'xsf:emailAdapter/to',
      'xsf:emailAdapter/subject',
      'xsf:emailAdapter/intro',
      'xsf:emailAdapter/attachmentFileName',
    ]);
    expect(m.connectionExtensions.map((e) => [e.key, e.adapterPath])).toEqual([
      ['xsf2:emailAdapterExtension', email!.path],
    ]);
  });

  test('form 01: submit attributes and the email fields', () => {
    const { submit } = form(1);
    expect(submit!.attrs).toEqual({
      caption: 'Su&bmit',
      disableMenuItem: 'no',
      onAfterSubmit: 'keepOpen',
      showStatusDialog: 'yes',
    });
    expect(submit!.adapters[0]!.children.map((c) => c.attrs)).toEqual([
      { value: 'my:managerEmail', valueType: 'expression' },
      { value: 'Leave Request', valueType: 'literal' },
      { value: 'This message was created by a Microsoft InfoPath form.' },
      { value: 'Leave Request', valueType: 'literal' },
    ]);
  });

  test('form 44: submitToHostAdapter with the submit errorMessage text', () => {
    const { submit } = form(44);
    expect(submit!.adapters.map((a) => [a.key, a.attrs])).toEqual([
      ['xsf:submitToHostAdapter', { name: 'Main Data Connection', submitAllowed: 'yes' }],
    ]);
    expect(submit!.errorMessage).toMatchObject({
      key: 'xsf:submit/errorMessage',
      text: 'The form cannot be submitted because of an error.',
      attrs: {},
    });
    expect(submit).not.toHaveProperty('successMessage');
  });

  test('form 46: davAdapter with folderURL and an expression fileName', () => {
    const [dav] = form(46).submit!.adapters;
    expect(dav!.attrs).toEqual({
      name: 'Main submit',
      submitAllowed: 'yes',
      overwriteAllowed: 'no',
    });
    expect(dav!.children.map((c) => [c.key, c.attrs])).toEqual([
      ['xsf:davAdapter/folderURL', { value: 'http://forms-legacy/vendors/' }],
      [
        'xsf:davAdapter/fileName',
        { value: 'concat(my:vendorName, "-", my:taxId)', valueType: 'expression' },
      ],
    ]);
  });

  test('no other sample has data objects, a main query or data adapters', () => {
    for (const [slug, m] of all) {
      if (slug.startsWith('03-') || slug.startsWith('04-')) continue;
      expect(m.dataObjects, slug).toEqual([]);
    }
    for (const [slug, m] of all) {
      expect(m.dataAdapters, slug).toEqual([]);
      expect(m, slug).not.toHaveProperty('mainQuery');
    }
  });
});

describe('R11.5 containsCredential (cases shared with spec 02 R8.4: test/xsf/credentials.test.ts)', () => {
  test('every other adapter kind is false', () => {
    const m = parseManifest(
      manifestBytes(
        `<xsf:dataAdapters><xsf:xmlFileAdapter name="x" fileUrl="Password=1"/></xsf:dataAdapters>`,
      ),
    ).manifest;
    expect(m.dataAdapters[0]!.containsCredential).toBe(false);
  });
});

describe('synthetic: SharePoint list adapters (fixtures/synthetic/sharepoint-adapters.xsf)', () => {
  const { manifest: m, unknowns } = fixture('sharepoint-adapters.xsf');

  test('both list adapters with their fields', () => {
    const [list, rw, misspelt] = m.dataObjects;
    expect(list!.query!.key).toBe('xsf:sharepointListAdapter');
    expect(list!.query!.attrs).toMatchObject({ siteUrl: 'http://forms-legacy/sites/hr/' });
    expect(list!.query!.children.map((c) => [c.key, c.attrs])).toEqual([
      ['xsf:sharepointListAdapter/field', { sharepointName: 'Title', infopathName: 'Title' }],
      [
        'xsf:sharepointListAdapter/field',
        { sharepointName: 'Manager', infopathName: 'Manager', isLookup: 'yes' },
      ],
    ]);
    expect(rw!.query!.key).toBe('xsf:sharepointListAdapterRW');
    expect(rw!.query!.children.map((c) => c.attrs)).toEqual([
      { internalName: 'Title', type: 'Text', required: 'yes' },
      { internalName: 'Days', type: 'Number', required: 'no', appendOnly: 'no' },
    ]);
    expect(misspelt).not.toHaveProperty('query');
  });

  test('the misspelling sharePointListAdapterRW is one unknown entry, documented: false', () => {
    expect(unknowns.map((u) => [u.kind, u.name, u.path, u.documented])).toEqual([
      [
        'element',
        'sharePointListAdapterRW',
        '/xsf:xDocumentClass[1]/xsf:dataObjects[1]/xsf:dataObject[3]/xsf:query[1]/xsf:sharePointListAdapterRW[1]',
        false,
      ],
    ]);
  });

  test('extensions linked by ref', () => {
    const [list, rw] = m.dataObjects;
    expect(m.connectionExtensions.map((e) => [e.key, e.attrs, e.adapterPath])).toEqual([
      [
        'xsf2:sharepointListAdapterExtension',
        {
          ref: 'Departments',
          sharepointWebGuid: '{00000000-0000-0000-0000-000000000003}',
          queryThisFormOnly: 'no',
        },
        list!.query!.path,
      ],
      [
        'xsf2:sharepointListAdapterRWExtension',
        { ref: 'Requests', queryThisFormOnly: 'yes' },
        rw!.query!.path,
      ],
    ]);
  });
});

describe('synthetic: connectoid (fixtures/synthetic/connectoid.xsf)', () => {
  const { manifest: m, unknowns } = fixture('connectoid.xsf');

  test('no unknown entries; a password in the connection string is flagged', () => {
    expect(unknowns).toEqual([]);
    expect(m.dataObjects[0]!.query!.containsCredential).toBe(true);
  });

  test('connectoids, relativeQuery and links; an unmatched ref has no adapterPath', () => {
    const [ado, ws, http, xml] = m.connectionExtensions;
    expect(ado!.adapterPath).toBe(m.dataObjects[0]!.query!.path);
    expect(ado!.connectoid!.attrs).toEqual({
      name: 'Vendors',
      source: 'http://forms-legacy/DataConnections/vendors.udcx',
      siteCollection: 'http://forms-legacy/',
      connectionLinkType: 'relative',
    });
    expect(ws!.adapterPath).toBe(m.dataObjects[1]!.query!.path);
    expect(ws!.relativeQuery!.attrs).toEqual({ replace: 'BudgetService.asmx' });
    expect(http!.key).toBe('xsf2:useHttpHandlerExtension');
    expect(http!.adapterPath).toBe(m.submit!.adapters[0]!.path);
    expect(http!.connectoid!.attrs).toEqual({ name: 'Submit', source: 'submit.udcx' });
    expect(xml!.attrs).toEqual({ ref: 'Nowhere', isRest: 'no' });
    expect(xml).not.toHaveProperty('adapterPath');
    expect(xml).not.toHaveProperty('connectoid');
  });

  test('useHttpHandler in submit', () => {
    expect(m.submit!.adapters.map((a) => [a.key, a.attrs])).toEqual([
      ['xsf:useHttpHandler', { href: 'http://forms-legacy/submit.aspx', method: 'POST' }],
    ]);
  });
});

describe('synthetic: every adapter kind in each place it can sit (R11.3)', () => {
  const { manifest: m, unknowns } = parseManifest(
    manifestBytes(`<xsf:query><xsf:bdcAdapter name="Main" entityName="Customer" lobSystemInstance="CRM" queryAllowed="yes"/></xsf:query>
<xsf:submit caption="Send" onAfterSubmit="openNew" showSignatureReminder="no">
  <xsf:ruleSetAction ruleSet="beforeSubmit"/>
  <xsf:submitAction adapter="Hub"/>
  <xsf:webServiceAdapter name="Hub" wsdlUrl="http://forms-legacy/hub.asmx?WSDL" submitAllowed="yes"><xsf:operation name="Put"><xsf:input source="in.xml"/></xsf:operation></xsf:webServiceAdapter>
  <xsf:useScriptHandler/>
  <xsf:useQueryAdapter/>
  <xsf:successMessage>  Sent.  </xsf:successMessage>
  <xsf:errorMessage>Not sent.</xsf:errorMessage>
</xsf:submit>
<xsf:dataAdapters>
  <xsf:hwsAdapter name="Task" wsdlUrl="http://forms-legacy/hws.asmx?WSDL" submitAllowed="yes"><xsf:hwsOperation type="addTask" serviceUrl="http://forms-legacy/hws.asmx"><xsf:input source="task.xml"/></xsf:hwsOperation></xsf:hwsAdapter>
  <xsf:emailAdapter name="Mail" submitAllowed="yes"><xsf:to value="a@contoso-fictional.example"/><xsf:cc value="b"/><xsf:bcc value="c"/></xsf:emailAdapter>
  <xsf:davAdapter name="Library" submitAllowed="yes"><xsf:folderURL value="http://forms-legacy/lib/"/><xsf:fileName value="f" valueType="literal"/></xsf:davAdapter>
  <xsf:adoAdapter name="Db" connectionString="Data Source=sql-legacy01"/>
  <xsf:submitToHostAdapter name="Host" submitAllowed="yes"/>
  <xsf:xmlFileAdapter name="File" fileUrl="file.xml"/>
  <xsf:sharepointListAdapter name="List" siteUrl="http://forms-legacy/"/>
  <xsf:webServiceAdapter name="Ws" wsdlUrl="http://forms-legacy/ws.asmx?WSDL"/>
</xsf:dataAdapters>
<xsf:ruleSets><xsf:ruleSet name="beforeSubmit"><xsf:rule caption="r"/></xsf:ruleSet></xsf:ruleSets>`),
  );

  test('no unknown entries', () => {
    expect(unknowns).toEqual([]);
  });

  test('the main query: a bdcAdapter', () => {
    expect(m.mainQuery).toMatchObject({
      key: 'xsf:bdcAdapter',
      role: 'query',
      attrs: {
        name: 'Main',
        entityName: 'Customer',
        lobSystemInstance: 'CRM',
        queryAllowed: 'yes',
      },
    });
  });

  test('submit: attributes, adapters and handlers in document order, action, messages, binding', () => {
    const s = m.submit!;
    expect(s.attrs).toEqual({
      caption: 'Send',
      onAfterSubmit: 'openNew',
      showSignatureReminder: 'no',
    });
    expect(s.adapters.map((a) => [a.key, a.role])).toEqual([
      ['xsf:webServiceAdapter', 'submit'],
      ['xsf:useScriptHandler', 'submit'],
      ['xsf:useQueryAdapter', 'submit'],
    ]);
    expect(childKeys(s.adapters[0]!)).toEqual(['xsf:operation', 'xsf:input']);
    expect(s.submitAction!.attrs).toEqual({ adapter: 'Hub' });
    expect(s.successMessage!.text).toBe('  Sent.  ');
    expect(s.errorMessage!.text).toBe('Not sent.');
    expect(m.bindings.map((b) => [b.trigger, b.attrs])).toEqual([
      [{ kind: 'submit' }, { ruleSet: 'beforeSubmit' }],
    ]);
  });

  test('data adapters in document order, with their children', () => {
    expect(m.dataAdapters.map((a) => [a.key, a.role, childKeys(a)])).toEqual([
      ['xsf:hwsAdapter', 'dataAdapter', ['xsf:hwsOperation', 'xsf:input']],
      [
        'xsf:emailAdapter',
        'dataAdapter',
        ['xsf:emailAdapter/to', 'xsf:emailAdapter/cc', 'xsf:emailAdapter/bcc'],
      ],
      ['xsf:davAdapter', 'dataAdapter', ['xsf:davAdapter/folderURL', 'xsf:davAdapter/fileName']],
      ['xsf:adoAdapter', 'dataAdapter', []],
      ['xsf:submitToHostAdapter', 'dataAdapter', []],
      ['xsf:xmlFileAdapter', 'dataAdapter', []],
      ['xsf:sharepointListAdapter', 'dataAdapter', []],
      ['xsf:webServiceAdapter', 'dataAdapter', []],
    ]);
  });

  test('11 of the 13 R11.3 kinds appear here; sharepointListAdapterRW and useHttpHandler are in the fixtures', () => {
    const kinds = new Set(
      [m.mainQuery!, ...m.submit!.adapters, ...m.dataAdapters].map((a) => a.key),
    );
    expect(kinds.size).toBe(11);
  });
});

describe('positions held once', () => {
  test('the root query keeps its queryAction as an unknown entry, documented: true', () => {
    const { manifest, unknowns } = parseManifest(
      manifestBytes('<xsf:query><xsf:queryAction adapter="Main"/></xsf:query>'),
    );
    expect(manifest).not.toHaveProperty('mainQuery');
    expect(unknowns.map((u) => [u.name, u.documented])).toEqual([['queryAction', true]]);
  });
});
