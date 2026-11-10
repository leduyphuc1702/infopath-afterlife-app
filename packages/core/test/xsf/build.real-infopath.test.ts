import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseManifest } from '../../src/xsf/parse-manifest';
import type { Menu } from '../../src/xsf/types';

// R21.2–R21.4 (spec 01 addendum, design §15.2): manifest elements that real InfoPath files use and
// MS-IPFF2 defines at that position. One synthetic fixture per element, written for this project.

const fixture = (name: string) =>
  parseManifest(
    new Uint8Array(
      readFileSync(new URL(`../fixtures/synthetic/real-infopath/${name}`, import.meta.url)),
    ),
    name,
  );

/** Each fixture must parse with nothing unknown and no issues. */
const clean = (name: string) => {
  const parsed = fixture(name);
  expect(parsed.unknowns, name).toEqual([]);
  expect(parsed.issues, name).toEqual([]);
  return parsed.manifest;
};

const captions = (menus: readonly Menu[]): unknown[] =>
  menus.map((m) => ({
    caption: m.attrs.caption,
    buttons: m.buttons.map((b) => b.attrs.caption),
    menus: captions(m.menus),
  }));

describe('xsf:importSource (import-source.xsf)', () => {
  test('both sources, every attribute, in document order', () => {
    const m = clean('import-source.xsf');
    expect(m.importParameters!.attrs).toEqual({ enabled: 'yes', useScriptHandler: 'no' });
    expect(m.importSources.map((s) => s.attrs)).toEqual([
      {
        name: 'Old visitor form',
        schema: 'old-form.xsd',
        transform: 'merge-v1.xsl',
        authoringOfTransform: 'automatic',
      },
      {
        name: 'Paper intake',
        schema: 'old-form.xsd',
        transform: 'merge-v1.xsl',
        authoringOfTransform: 'manual',
      },
    ]);
    expect(m.importSources[1]).toMatchObject({
      key: 'xsf:importSource',
      path: '/xsf:xDocumentClass[1]/xsf:importParameters[1]/xsf:importSource[2]',
      line: 13,
    });
  });
});

describe('xsf:menu (menus.xsf)', () => {
  const m = clean('menus.xsf');
  const view = m.views[0]!;

  test('a menu directly in the view', () => {
    expect(captions(view.menus)).toEqual([{ caption: 'Rows', buttons: ['Add a row'], menus: [] }]);
  });

  test('a menu area keeps its own buttons apart from its nested menus', () => {
    const area = view.menuAreas[0]!;
    expect(area.buttons.map((b) => b.attrs.caption)).toEqual(['Row']);
    expect(captions(area.menus)).toEqual([
      {
        caption: 'Section',
        buttons: ['Notes'],
        menus: [{ caption: 'More', buttons: ['Remove notes'], menus: [] }],
      },
    ]);
    expect(area.menus[0]!.menus[0]!.path).toBe(
      '/xsf:xDocumentClass[1]/xsf:views[1]/xsf:view[1]/xsf:menuArea[1]/xsf:menu[1]/xsf:menu[1]',
    );
  });

  test('a menu in a toolbar, with every button attribute', () => {
    const bar = view.toolbars[0]!;
    expect(bar.buttons).toEqual([]);
    expect(bar.menus[0]!.buttons.map((b) => b.attrs)).toEqual([
      { action: 'xCollection::insertBefore', xmlToEdit: 'row_1', caption: 'Above' },
      { action: 'xCollection::insertAfter', xmlToEdit: 'row_1', caption: 'Below' },
    ]);
  });
});

describe('xsf:taskpane (taskpane.xsf)', () => {
  test('caption and href', () => {
    const m = clean('taskpane.xsf');
    expect(m.taskpane).toMatchObject({
      key: 'xsf:taskpane',
      path: '/xsf:xDocumentClass[1]/xsf:taskpane[1]',
      attrs: { caption: 'How to fill this form', href: 'helppane.htm' },
    });
  });
});

describe('xsf2:preview (preview.xsf)', () => {
  test('every attribute', () => {
    const { solution } = clean('preview.xsf');
    expect(solution.preview!.attrs).toEqual({
      sampleData: 'yes',
      domain: 'http://forms-legacy/preview/',
      userRole: 'Reviewer',
    });
  });
});

describe('xsf2:solutionPropertiesExtension (solution-properties.xsf)', () => {
  test('the branch attribute and the branch elements in document order', () => {
    const ext = clean('solution-properties.xsf').solution.propertiesExtension!;
    expect(ext.attrs).toEqual({ branch: 'wss' });
    expect(ext.branches.map((b) => b.key)).toEqual(['xsf2:wss', 'xsf2:share', 'xsf2:admin']);
    expect(ext.branches[0]!.attrs).toEqual({
      path: 'http://forms-legacy/sites/facilities/Requests',
      name: 'Room booking',
      description: 'Book a meeting room',
      browserEnable: 'yes',
    });
    expect(ext.branches[1]!.attrs).toEqual({
      formName: 'Room booking',
      path: '\\\\files-legacy\\forms\\room-booking.xsn',
      accessPath: '\\\\files-legacy\\forms\\room-booking.xsn',
    });
  });

  test('a branch value outside the MS-IPFF2 list is kept and reported (R13.4)', () => {
    const text = readFileSync(
      new URL('../fixtures/synthetic/real-infopath/solution-properties.xsf', import.meta.url),
      'utf8',
    ).replace('branch="wss"', 'branch="cloud"');
    const { manifest, unknowns } = parseManifest(new TextEncoder().encode(text));
    expect(manifest.solution.propertiesExtension!.attrs.branch).toBe('cloud');
    expect(unknowns.map((u) => [u.name, u.reason])).toEqual([['branch', 'unexpectedValue']]);
  });
});

describe('xsf2:toolbar in xsf2:server (server-toolbar.xsf)', () => {
  test('the toolbar and its commands', () => {
    const { solution } = clean('server-toolbar.xsf');
    expect(solution.server!.attrs.formLocale).toBe('en-GB');
    expect(solution.serverToolbar!.attrs).toEqual({ enabledTop: 'yes', enabledBottom: 'no' });
    expect(solution.serverToolbar!.commands.map((c) => c.attrs)).toEqual([
      { action: 'submit', caption: 'Send it' },
      { action: 'close' },
      { action: 'print', caption: 'Print a copy' },
    ]);
  });

  test('xsf2:commands is a container', () => {
    const m = clean('server-toolbar.xsf');
    expect(m.containers.map((c) => c.key)).toContain('xsf2:commands');
  });
});

describe('xsf2:xmlToEditExtension (xml-to-edit-extension.xsf)', () => {
  const m = clean('xml-to-edit-extension.xsf');
  const view = m.views[0]!;
  const ext = view.extensions[0]!;

  test('the view extension holds all three, in document order', () => {
    expect(ext.key).toBe('xsf2:viewExtension');
    if (ext.key !== 'xsf2:viewExtension') return;
    expect(ext.xmlToEditExtensions.map((x) => x.attrs)).toEqual([
      { ref: 'notes_1', allowLinkedImages: 'no', excludeEmbeddedImages: 'yes' },
      {
        ref: 'agenda_2',
        allowLinkedImages: 'yes',
        allowedLinkImages: 'yes',
        excludeEmbeddedImages: 'no',
      },
      { ref: 'gone_9', allowLinkedImages: 'no', excludeEmbeddedImages: 'no' },
    ]);
  });

  test('each xmlToEdit links the extension whose ref is its name; an unmatched ref links nowhere', () => {
    expect(view.xmlToEdit.map((x) => [x.attrs.name, x.extensions.map((e) => e.attrs.ref)])).toEqual(
      [
        ['notes_1', ['notes_1']],
        ['agenda_2', ['agenda_2']],
      ],
    );
    if (ext.key !== 'xsf2:viewExtension') return;
    expect(view.xmlToEdit[0]!.extensions[0]).toBe(ext.xmlToEditExtensions[0]);
  });
});

describe('allowedLinkImages on xsf2:xmlToEditExtension (R21.4)', () => {
  test('kept as written, with no value check', () => {
    const text = readFileSync(
      new URL('../fixtures/synthetic/real-infopath/xml-to-edit-extension.xsf', import.meta.url),
      'utf8',
    ).replace('allowedLinkImages="yes"', 'allowedLinkImages="sometimes"');
    const { manifest, unknowns } = parseManifest(new TextEncoder().encode(text));
    const ext = manifest.views[0]!.extensions[0]!;
    expect(unknowns).toEqual([]);
    if (ext.key !== 'xsf2:viewExtension') throw new Error('expected an xsf2 view extension');
    expect(ext.xmlToEditExtensions[1]!.attrs.allowedLinkImages).toBe('sometimes');
  });
});

describe('xsf3:solutionPropertiesExtension2009 (R21.3)', () => {
  test('modelled inside xsf:extension, with its solutionMode', () => {
    const { solution, containers } = clean('solution-properties-2009.xsf');
    expect(solution.propertiesExtension2009).toMatchObject({
      key: 'xsf3:solutionPropertiesExtension2009',
      path: '/xsf:xDocumentClass[1]/xsf:extensions[1]/xsf:extension[2]/xsf3:solutionPropertiesExtension2009[1]',
      attrs: {},
    });
    expect(solution.propertiesExtension2009!.solutionMode!.attrs).toEqual({
      mode: 'list',
      isListEditForm: 'yes',
      originalPublishUrl: 'http://forms-legacy/sites/facilities/Lists/Rooms',
      originalCtid: '0x0100FICTIONAL',
    });
    expect(solution.runtimeCompatibility).toEqual(['client', 'server']);
    expect(containers.filter((c) => c.key === 'xsf:extension').map((c) => c.attrs.name)).toEqual([
      'SolutionDefinitionExtensions',
      'SolutionPropertiesExtension2009',
    ]);
  });

  test('a second copy is one repeated entry and one REPEATED_ELEMENT issue (rule parser)', () => {
    const { manifest, unknowns, issues } = fixture('solution-properties-2009-twice.xsf');
    expect(manifest.solution.propertiesExtension2009!.solutionMode!.attrs.mode).toBe('list');
    expect(unknowns.map((u) => [u.kind, u.reason, u.name, u.documented, u.path])).toEqual([
      [
        'element',
        'repeated',
        'solutionPropertiesExtension2009',
        true,
        '/xsf:xDocumentClass[1]/xsf:extensions[1]/xsf:extension[2]/xsf3:solutionPropertiesExtension2009[1]',
      ],
    ]);
    expect(issues.map((i) => [i.code, i.details?.element, i.details?.rule])).toEqual([
      ['REPEATED_ELEMENT', 'xsf3:solutionPropertiesExtension2009', 'parser'],
    ]);
  });
});
