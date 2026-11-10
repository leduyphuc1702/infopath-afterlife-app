import { describe, expect, test } from 'vitest';
import { parsePackage, parseXsn } from '../../src/index';
import { fileReferences, solutionName, unsafe } from '../../src/xsn/package';
import { catchError } from '../helpers/catch-error';
import { minimalPackage, packageFile, sampleFiles } from '../helpers/package';
import { readSample, sampleCabinets } from '../helpers/samples';

// R6.1–R6.6, design §10.

describe('R6.1 manifest discovery', () => {
  test('no .xsf: MISSING_MANIFEST listing the names', () => {
    const e = catchError(() =>
      parsePackage([packageFile('a.xml', '<a/>'), packageFile('b.xsd', '<b/>')]),
    );
    expect(e).toMatchObject({ code: 'MISSING_MANIFEST', details: { names: 'a.xml,b.xsd' } });
  });

  test('two .xsf files and no manifest.xsf: MISSING_MANIFEST', () => {
    const [m] = minimalPackage();
    const e = catchError(() =>
      parsePackage([
        { ...m!, name: 'a.xsf' },
        { ...m!, name: 'b.xsf' },
      ]),
    );
    expect(e).toMatchObject({ code: 'MISSING_MANIFEST', details: { names: 'a.xsf,b.xsf' } });
  });

  test('the only other .xsf is used', () => {
    const t = parsePackage(minimalPackage('', { manifestName: 'form.xsf' }));
    expect(t.manifestFile).toBe('form.xsf');
  });

  test('Manifest.XSF matches case-insensitively and wins over another .xsf', () => {
    const files = [
      ...minimalPackage('', { manifestName: 'Manifest.XSF' }),
      packageFile('other.xsf', '<x/>'),
    ];
    const t = parsePackage(files);
    expect(t.manifestFile).toBe('Manifest.XSF');
    expect(t.issues.map((i) => [i.code, i.file])).toEqual([['UNLISTED_FILE', 'other.xsf']]);
  });
});

describe('R6.2–R6.3: each reference kind, missing in turn', () => {
  test.each([
    ['05-new-hire-onboarding', 'view2.xsl', 'mainpane'],
    ['05-new-hire-onboarding', 'upgrade.xsl', 'useTransform'],
    ['05-new-hire-onboarding', 'template.xml', 'initialXmlDocument'],
    ['05-new-hire-onboarding', 'myschema.xsd', 'documentSchema'],
    ['03-travel-request', 'locations.xsd', 'dataObject'],
    ['03-travel-request', 'locations.xml', 'xmlFileAdapter'],
    ['04-purchase-request', 'BudgetServiceInput.xml', 'input'],
    ['47-asset-checkout-script', 'script.js', 'script'],
  ])('%s without %s: MISSING_FILE for %s (and for xsf:file)', async (slug, name, kind) => {
    const files = (await sampleFiles(slug)).filter((f) => f.name !== name);
    const t = parsePackage(files);
    const missing = t.issues.filter((i) => i.code === 'MISSING_FILE');
    expect(missing.map((i) => i.details?.kind).sort()).toEqual(['file', kind].sort());
    for (const i of missing) {
      expect(i.details?.name).toBe(name);
      expect(i.path).toMatch(/^\/xsf:xDocumentClass\[1\]\/.*\/@[A-Za-z]+$/);
    }
  });

  test('references compare ignoring case', async () => {
    const files = (await sampleFiles('05-new-hire-onboarding')).map((f) =>
      f.name === 'view2.xsl' ? { ...f, name: 'VIEW2.XSL' } : f,
    );
    expect(parsePackage(files).issues).toEqual([]);
  });

  test('a remote or absolute xmlFileAdapter fileUrl is not a package reference', () => {
    const t = parsePackage(
      minimalPackage(
        '<xsf:dataAdapters><xsf:xmlFileAdapter fileUrl="http://forms-legacy/a.xml"/><xsf:xmlFileAdapter fileUrl="C:\\a.xml"/><xsf:xmlFileAdapter fileUrl="sub/b.xml"/></xsf:dataAdapters>',
      ),
    );
    expect(fileReferences(t.manifest).map((r) => [r.kind, r.name])).toEqual([
      ['xmlFileAdapter', 'b.xml'],
    ]);
  });

  test('R21.2: importSource transform and schema, and a relative taskpane href, are references', () => {
    const t = parsePackage(
      minimalPackage(
        '<xsf:importParameters enabled="yes"><xsf:importSource name="a" schema="old.xsd" transform="merge.xsl"/></xsf:importParameters><xsf:taskpane caption="Help" href="help/pane.htm"/>',
        { listed: ['old.xsd'], extra: [packageFile('old.xsd', '<x/>')] },
      ),
    );
    expect(fileReferences(t.manifest).map((r) => [r.kind, r.name])).toEqual([
      ['file', 'old.xsd'],
      ['importSource', 'merge.xsl'],
      ['importSource', 'old.xsd'],
      ['taskpane', 'pane.htm'],
    ]);
    const missing = t.issues.filter((i) => i.code === 'MISSING_FILE');
    expect(missing.map((i) => [i.details?.kind, i.details?.name])).toEqual([
      ['importSource', 'merge.xsl'],
      ['taskpane', 'pane.htm'],
    ]);
  });

  test('R21.2: a taskpane href that is a URL is not a package reference', () => {
    const t = parsePackage(
      minimalPackage('<xsf:taskpane caption="Help" href="http://forms-legacy/help.htm"/>'),
    );
    expect(fileReferences(t.manifest)).toEqual([]);
  });

  test('documentSchema/@location: the last token is the file', async () => {
    const t = parsePackage(await sampleFiles('05-new-hire-onboarding'));
    expect(
      fileReferences(t.manifest)
        .filter((r) => r.kind === 'documentSchema')
        .map((r) => r.name),
    ).toEqual(['myschema.xsd']);
  });
});

describe('R6.4 and R6.5', () => {
  test('a file not in xsf:files is UNLISTED_FILE; the manifest is exempt', () => {
    const t = parsePackage(
      minimalPackage('', {
        listed: ['a.xml'],
        extra: [packageFile('a.xml', '<a/>'), packageFile('b.xml', '<b/>')],
      }),
    );
    expect(t.issues.map((i) => [i.code, i.file])).toEqual([['UNLISTED_FILE', 'b.xml']]);
  });

  test('duplicate names ignoring case: DUPLICATE_NAME; both files kept', () => {
    const t = parsePackage(
      minimalPackage('', {
        listed: ['a.xml'],
        extra: [packageFile('a.xml', '<a/>'), packageFile('A.XML', '<b/>')],
      }),
    );
    expect(t.issues.map((i) => [i.code, i.details])).toEqual([
      ['DUPLICATE_NAME', { name: 'A.XML', other: 'a.xml' }],
    ]);
    expect(t.files.map((f) => f.name)).toEqual(['manifest.xsf', 'a.xml', 'A.XML']);
  });

  test.each([
    ['../evil.xml', 'parentSegment'],
    ['dir\\..\\x.xml', 'parentSegment'],
    ['C:evil.xml', 'driveLetter'],
    ['/etc/passwd', 'leadingSeparator'],
    ['\\x.xml', 'leadingSeparator'],
  ])('%s: UNSAFE_NAME (%s), bytes kept', (name, reason) => {
    const t = parsePackage(minimalPackage('', { listed: [name], extra: [packageFile(name, 'x')] }));
    expect(t.issues.map((i) => [i.code, i.details?.reason])).toEqual([['UNSAFE_NAME', reason]]);
    expect(t.files.find((f) => f.name === name)!.bytes).toEqual(new TextEncoder().encode('x'));
  });

  test('".." inside a name is not a path segment', () => {
    expect(unsafe('notes..v2.xml')).toBeUndefined();
    const name = 'notes..v2.xml';
    const t = parsePackage(minimalPackage('', { listed: [name], extra: [packageFile(name, 'x')] }));
    expect(t.issues).toEqual([]);
  });
});

describe('R6.6 URN check', () => {
  const pi = (name: string) =>
    `<?xml version="1.0"?><?mso-infoPathSolution solutionVersion="1.0.0.1" productVersion="15.0.0" PIVersion="1.0.0.0" name="${name}" ?><my:a xmlns:my="urn:my"/>`;

  test('a different name records URN_MISMATCH', () => {
    const t = parsePackage(
      minimalPackage('', {
        listed: ['template.xml'],
        extra: [packageFile('template.xml', pi('urn:other'))],
      }),
    );
    expect(t.issues.map((i) => [i.code, i.details])).toEqual([
      ['URN_MISMATCH', { template: 'urn:other', manifest: 'urn:x' }],
    ]);
  });

  test('the same name, or no PI, records nothing', () => {
    for (const body of [pi('urn:x'), '<my:a xmlns:my="urn:my"/>']) {
      const t = parsePackage(
        minimalPackage('', {
          listed: ['template.xml'],
          extra: [packageFile('template.xml', body)],
        }),
      );
      expect(t.issues).toEqual([]);
    }
  });

  test('only the first 4 KB are read; UTF-16 is detected', () => {
    const late = `<!--${' '.repeat(5000)}-->${pi('urn:other')}`;
    expect(solutionName(new TextEncoder().encode(late))).toBeUndefined();
    const utf16 = new Uint8Array([
      0xff,
      0xfe,
      ...[...pi('urn:u16')].flatMap((c) => [c.charCodeAt(0), 0]),
    ]);
    expect(solutionName(utf16)).toBe('urn:u16');
  });
});

test('every sample: none of the package issues', async () => {
  for (const cab of sampleCabinets()) {
    const t = await parseXsn(readSample(cab.path));
    expect(t.issues, cab.slug).toEqual([]);
  }
});
