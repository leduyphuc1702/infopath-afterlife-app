import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Manifest, Xsf3ViewExtension } from '../../src/xsf/types';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { formNumber, sampleManifests } from '../helpers/manifests';

// R12.1–R12.6 (manifest part): promoted fields, signatures, signature lines, roles, managed code,
// scripts, ActiveX permissions.

const manifests = await sampleManifests();
const all = manifests.map((m) => [m.slug, parseManifest(m.bytes).manifest] as const);
const form = (n: number): Manifest =>
  all.find(([slug]) => !slug.startsWith('theill') && formNumber(slug) === n)![1];
const publicSample = all.find(([slug]) => slug.startsWith('theill'))![1];

const fixture = (name: string) =>
  parseManifest(
    new Uint8Array(readFileSync(new URL(`../fixtures/synthetic/${name}`, import.meta.url))),
  );

describe('R12.6 oracle', () => {
  test('public sample: 1 promoted field, Date', () => {
    expect(publicSample.promotedFields.map((f) => f.attrs)).toEqual([
      {
        name: 'Date',
        columnName: '{05313C16-8C1A-4436-9594-DC8029730BDF}',
        node: '/my:myFields/my:Date',
        type: 'xsd:date',
      },
    ]);
    expect(publicSample.promotedFields[0]!.path).toBe(
      '/xsf:xDocumentClass[1]/xsf:listProperties[1]/xsf:fields[1]/xsf:field[1]',
    );
  });

  test('no own form has promoted fields', () => {
    for (const [slug, m] of all) {
      if (!slug.startsWith('theill')) expect(m.promotedFields, slug).toEqual([]);
    }
  });

  test('form 45: a countersigned signedDataBlock with its paths and message', () => {
    const sig = form(45).signatures!;
    expect(sig.attrs).toEqual({});
    expect(sig.blocks).toHaveLength(1);
    expect(sig.blocks[0]!.attrs).toEqual({
      name: 'acknowledgement',
      data: '/my:policyAcknowledgement',
      signatureLocation: '/my:policyAcknowledgement/my:signatures1/my:signatures2',
      mode: 'countersign',
    });
    expect(sig.blocks[0]!.message).toMatchObject({
      key: 'xsf:signedDataBlock/message',
      text: 'Verify that the form you are signing is correct, as well as the additional information that will be stored with your signature.',
    });
  });

  test('form 46: managedCode as written, projectPath included', () => {
    expect(form(46).solution.managedCode!.attrs).toEqual({
      language: 'CSharp',
      version: '4.0',
      projectPath: 'C:\\Users\\formdev\\Documents\\InfoPath Projects\\VendorOnboarding',
    });
  });

  test('form 47: JScript scripts with one script.js', () => {
    const s = form(47).scripts!;
    expect(s.attrs).toEqual({ language: 'jscript', enforceScriptTimeout: 'yes' });
    expect(s.scripts.map((x) => x.attrs)).toEqual([{ src: 'script.js' }]);
  });

  test('only forms 45, 46 and 47 carry signatures, managed code and scripts', () => {
    const which = (f: (m: Manifest) => boolean) =>
      all.filter(([, m]) => f(m)).map(([slug]) => slug.slice(0, 2));
    expect(which((m) => m.signatures !== undefined)).toEqual(['45']);
    expect(which((m) => m.solution.managedCode !== undefined)).toEqual(['46']);
    expect(which((m) => m.scripts !== undefined)).toEqual(['47']);
    expect(which((m) => m.roles !== undefined || m.allowedControls.length > 0)).toEqual([]);
  });
});

describe('synthetic: roles (fixtures/synthetic/roles.xsf)', () => {
  const { manifest: m, unknowns } = fixture('roles.xsf');

  test('no unknown entries', () => {
    expect(unknowns).toEqual([]);
  });

  test('roles and every membership entry, in document order', () => {
    const roles = m.roles!;
    expect(roles.attrs).toEqual({
      default: 'Requester',
      initiator: 'Requester',
      hideStatusBarDisplay: 'no',
    });
    expect(roles.roles.map((r) => r.attrs.name)).toEqual(['Requester', 'Approver']);
    expect(roles.membership.map((e) => [e.key, e.attrs])).toEqual([
      ['xsf:userName', { name: 'CONTOSO\\mai', memberOf: 'Approver' }],
      ['xsf:group', { name: 'CONTOSO\\Finance', memberOf: 'Approver' }],
      [
        'xsf:getUserNameFromData',
        {
          dataObject: 'Approvers',
          select: '/dfs:myFields/dfs:dataFields/d:Approver/@Login',
          memberOf: 'Approver',
        },
      ],
      ['xsf:userName', { name: 'CONTOSO\\tim', memberOf: 'Requester' }],
    ]);
  });
});

describe('synthetic: allowed controls (fixtures/synthetic/allowed-control.xsf)', () => {
  const { manifest: m, unknowns } = fixture('allowed-control.xsf');

  test('every allowedControl with clsid, cabFile and version as written', () => {
    expect(unknowns).toEqual([]);
    expect(m.allowedControls.map((c) => c.attrs)).toEqual([
      {
        clsid: '{00000000-0000-0000-0000-0000000000A1}',
        cabFile: 'contactselector.cab',
        version: '1.0.0.1',
      },
      { clsid: '{00000000-0000-0000-0000-0000000000A2}' },
    ]);
    expect(m.containers.map((c) => c.key)).toContain('xsf:permissions');
  });
});

describe('synthetic: signature lines (fixtures/synthetic/signature-lines.xsf)', () => {
  const { manifest: m, unknowns } = fixture('signature-lines.xsf');
  const ext = m.views[0]!.extensions[0] as Xsf3ViewExtension;

  test('no unknown entries; the view extension is linked to its view', () => {
    expect(unknowns).toEqual([]);
    expect(ext.key).toBe('xsf3:viewExtension');
  });

  test('signature lines with attributes and verbatim text children', () => {
    expect(ext.signatureLines).toHaveLength(2);
    const [line, stamp] = ext.signatureLines;
    expect(line!.attrs).toEqual({
      name: 'line1',
      signedDataBlock: 'approval',
      showDate: 'yes',
      signatureType: 'line',
    });
    expect(line!.confirmationMessage!.text).toBe('I approve this  request.');
    expect(line!.suggestedSignerName).toMatchObject({
      text: 'Hung Tran',
      attrs: { isCalculation: 'no' },
    });
    expect(line!.suggestedSignerTitle!.text).toBe('Approver');
    expect(line!.suggestedSignerEmailAddress).toMatchObject({
      text: '/my:form/my:approverEmail',
      attrs: { isCalculation: 'yes' },
    });
    expect(stamp!.attrs.signatureType).toBe('stamp');
    expect(stamp).not.toHaveProperty('confirmationMessage');
  });

  test('the signed data block the lines refer to', () => {
    expect(m.signatures!.attrs).toEqual({ signatureLocation: '/my:form/my:signatures' });
    expect(m.signatures!.blocks[0]!.attrs.mode).toBe('single');
    expect(m.signatures!.blocks[0]).not.toHaveProperty('message');
  });
});

test('synthetic: listPropertiesExtension fields', () => {
  const { manifest: m, unknowns } = parseManifest(
    new TextEncoder()
      .encode(`<xsf:xDocumentClass xmlns:xsf="http://schemas.microsoft.com/office/infopath/2003/solutionDefinition" xmlns:xsf2="http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions">
<xsf:listProperties><xsf:fields><xsf:field name="Total" columnName="{1}" node="/my:f/my:total" type="xsd:double" aggregation="sum" viewable="yes" required="no" maxLength="10"/></xsf:fields></xsf:listProperties>
<xsf:extensions><xsf:extension name="SolutionDefinitionExtensions"><xsf2:solutionDefinition>
<xsf2:listPropertiesExtension><xsf2:fieldsExtension><xsf2:fieldExtension columnId="{1}" columnName="Total" readWrite="yes"/></xsf2:fieldsExtension></xsf2:listPropertiesExtension>
</xsf2:solutionDefinition></xsf:extension></xsf:extensions>
</xsf:xDocumentClass>`),
  );
  expect(unknowns).toEqual([]);
  expect(m.promotedFields[0]!.attrs).toMatchObject({ aggregation: 'sum', viewable: 'yes' });
  expect(m.promotedFieldExtensions.map((f) => f.attrs)).toEqual([
    { columnId: '{1}', columnName: 'Total', readWrite: 'yes' },
  ]);
});
