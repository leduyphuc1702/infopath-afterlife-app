import { describe, expect, test } from 'vitest';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { formNumber, sampleManifests } from '../helpers/manifests';
import { manifestBytes, PRINT_SETTINGS_FIXTURE } from '../helpers/synthetic-manifest';

// R8.1–R8.5: views, print settings, view extensions, editing controls, buttons.

const manifests = await sampleManifests();
const parsed = new Map(manifests.map((m) => [m.slug, parseManifest(m.bytes)]));
const form = (n: number) => {
  const slug = manifests.find((m) => m.own && formNumber(m.slug) === n)!.slug;
  return parsed.get(slug)!.manifest;
};

describe('form 05 (R8.5)', () => {
  const m = form(5);

  test('3 views in document order; HR is the default', () => {
    expect(m.views.map((v) => [v.attrs.name, v.attrs.caption, v.isDefault])).toEqual([
      ['HR', 'HR', true],
      ['IT', 'IT', false],
      ['Manager', 'Manager', false],
    ]);
    expect(m.defaultView).toBe('HR');
    expect(m.views.map((v) => v.mainpanes.map((p) => p.attrs.transform))).toEqual([
      ['view1.xsl'],
      ['view2.xsl'],
      ['view3.xsl'],
    ]);
    expect(m.views[0]!.attrs).not.toHaveProperty('printView');
  });

  test('3 unbound buttons (the three switchViewAction buttons)', () => {
    expect(m.views.map((v) => v.unboundButtons.map((b) => b.attrs.name))).toEqual([
      ['CTRL910', 'CTRL911'],
      ['CTRL912'],
      [],
    ]);
    expect(m.views[0]!.unboundButtons[0]!.path).toBe(
      '/xsf:xDocumentClass[1]/xsf:views[1]/xsf:view[1]/xsf:unboundControls[1]/xsf:button[1]',
    );
  });

  test('xsf2:viewExtension linked to each view by ref', () => {
    expect(m.views.map((v) => v.extensions.map((e) => [e.key, e.attrs]))).toEqual(
      ['HR', 'IT', 'Manager'].map((ref) => [
        ['xsf2:viewExtension', { ref, designMode: 'normal', clientOnly: 'no' }],
      ]),
    );
    expect(m.unlinkedViewExtensions).toEqual([]);
  });

  test('editing controls, editWith and the chooseFragment payload', () => {
    const [hr, it, manager] = m.views;
    expect([hr, it, manager].map((v) => v!.xmlToEdit.length)).toEqual([16, 9, 14]);
    const fullTime = hr!.xmlToEdit[5]!;
    expect(fullTime.attrs).toEqual({
      name: 'fullTime_6',
      item: '/my:onboarding/my:employment/my:fullTime',
      container: '/my:onboarding/my:employment',
    });
    expect(fullTime.editWith!.attrs).toEqual({
      caption: 'fullTime',
      '{http://schemas.microsoft.com/office/infopath/2003}autogeneration': 'template',
      component: 'xReplace',
    });
    expect(fullTime.editWith!.fragments).toHaveLength(1);
    // The payload as the serialiser writes it: each element declares the namespaces it uses, and
    // empty elements are written <a/>. Text, attributes and whitespace are kept.
    expect(fullTime.editWith!.fragments[0]!.raw).toBe(
      '<my:fullTime xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:40:00">\n' +
        '\t<my:annualSalary xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>\n' +
        '\t<my:benefitsPlan/>\n' +
        '</my:fullTime>',
    );
    expect(manager!.xmlToEdit[13]!.editWith!.attrs).toMatchObject({ type: 'rich' });
  });

  test('menu area buttons', () => {
    expect(m.views[0]!.menuAreas.map((a) => a.attrs.name)).toEqual([
      'msoStructuralEditingContextMenu',
    ]);
    expect(m.views[0]!.menuAreas[0]!.buttons.map((b) => b.attrs)).toEqual([
      {
        action: 'xReplace::replace',
        xmlToEdit: 'fullTime_6',
        caption: 'Replace with fullTime',
        showIf: 'immediate',
      },
      {
        action: 'xReplace::replace',
        xmlToEdit: 'contractor_9',
        caption: 'Replace with contractor',
        showIf: 'immediate',
      },
    ]);
    expect(m.views[1]!.menuAreas[0]!.buttons).toEqual([]);
  });
});

describe('across forms 01–42 (R8.5)', () => {
  const editWith = manifests
    .filter((m) => m.own && formNumber(m.slug) <= 42)
    .flatMap((m) => parsed.get(m.slug)!.manifest.views)
    .flatMap((v) => v.xmlToEdit)
    .map((x) => x.editWith!);
  const count = (f: (e: (typeof editWith)[number]) => boolean) => editWith.filter(f).length;

  test('18 xCollection, 1 xOptional, 2 xReplace, 15 type="rich"', () => {
    expect(count((e) => e.attrs.component === 'xCollection')).toBe(18);
    expect(count((e) => e.attrs.component === 'xOptional')).toBe(1);
    expect(count((e) => e.attrs.component === 'xReplace')).toBe(2);
    expect(count((e) => e.attrs.type === 'rich')).toBe(15);
  });

  test('21 fragmentToInsert, each with one chooseFragment', () => {
    const fragments = manifests
      .filter((m) => m.own && formNumber(m.slug) <= 42)
      .flatMap((m) => parsed.get(m.slug)!.manifest.containers)
      .filter((c) => c.key === 'xsf:fragmentToInsert');
    expect(fragments).toHaveLength(21);
    expect(count((e) => e.fragments.length === 1)).toBe(21);
    expect(count((e) => e.fragments.length > 1)).toBe(0);
  });
});

describe('synthetic: print settings, header, footer, merged print view, xsf3', () => {
  const { manifest: m, unknowns } = parseManifest(manifestBytes(PRINT_SETTINGS_FIXTURE));

  test('no unknown entries', () => {
    expect(unknowns).toEqual([]);
  });

  test('view attributes and print settings with raw header and footer', () => {
    const main = m.views[0]!;
    expect(main.attrs).toEqual({
      name: 'Main',
      caption: 'Main',
      printView: 'Print',
      showMenuItem: 'yes',
      designMode: 'normal',
    });
    expect(main.printSettings).toHaveLength(1);
    const ps = main.printSettings[0]!;
    expect(ps.attrs).toEqual({
      orientation: 'landscape',
      marginUnitsType: 'cm',
      topMargin: '1.5',
      header: 'H',
      footer: 'F',
    });
    expect(ps.header!.raw).toBe('<b>Page</b> &amp;p of &amp;P');
    expect(ps.footer!.raw).toBe('  Confidential  ');
  });

  test('toolbar buttons', () => {
    expect(
      m.views[0]!.toolbars.map((t) => [t.attrs, t.buttons.map((b) => b.attrs.caption)]),
    ).toEqual([[{ name: 'tb', caption: 'Tools' }, ['Add']]]);
  });

  test('xsf2 and xsf3 view extensions by ref; an unmatched ref is kept apart', () => {
    expect(m.views[0]!.extensions.map((e) => e.key)).toEqual(['xsf3:viewExtension']);
    expect(m.views[1]!.extensions.map((e) => [e.key, e.attrs])).toEqual([
      ['xsf2:viewExtension', { ref: 'Print', readOnly: 'yes' }],
    ]);
    expect(m.unlinkedViewExtensions.map((e) => e.attrs)).toEqual([{ ref: 'Gone' }]);
  });

  test('merged print view with its print settings and included views', () => {
    expect(m.mergedPrintView!.attrs).toEqual({ isDefault: 'yes', viewBreak: 'pageBreak' });
    expect(m.mergedPrintView!.printSettings!.attrs).toEqual({ orientation: 'portrait' });
    expect(m.mergedPrintView!.includedViews.map((v) => v.attrs.name)).toEqual(['Main', 'Print']);
  });
});
