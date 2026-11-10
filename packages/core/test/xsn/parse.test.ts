import { describe, expect, test } from 'vitest';
import { parsePackage, parseXsn } from '../../src/index';
import { catchError } from '../helpers/catch-error';
import { minimalPackage, packageFile, sampleFiles, XSF_NS } from '../helpers/package';
import { readSample, sampleCabinets } from '../helpers/samples';

// R4.5 (non-manifest issue), R5.4, R11.6, R12.4 (code files), design §4–§5.

const XSD = 'xmlns:xsd="http://www.w3.org/2001/XMLSchema"';
const withSchemas = (extra: ReturnType<typeof packageFile>[]) =>
  minimalPackage(
    '<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="myschema.xsd"/></xsf:documentSchemas><xsf:dataObjects><xsf:dataObject name="Deep" schema="deep.xsd"/></xsf:dataObjects>',
    {
      listed: ['myschema.xsd', ...extra.map((f) => f.name)],
      extra: [
        packageFile(
          'myschema.xsd',
          `<xsd:schema ${XSD}><xsd:element name="r" type="xsd:string"/></xsd:schema>`,
        ),
        ...extra,
      ],
    },
  );

describe('R5.4: what is fatal', () => {
  test('a malformed manifest throws INVALID_XML with line and column', () => {
    const e = catchError(() =>
      parsePackage([
        packageFile(
          'manifest.xsf',
          `<xsf:xDocumentClass xmlns:xsf="${XSF_NS}">\n  <xsf:views></xsf:view></xsf:xDocumentClass>`,
        ),
      ]),
    );
    expect(e).toMatchObject({ code: 'INVALID_XML', details: { file: 'manifest.xsf', line: 2 } });
    expect(e.details).toHaveProperty('column');
  });

  test('a malformed schema and a DOCTYPE schema are issues; the rest still parses', () => {
    const t = parsePackage(
      withSchemas([
        packageFile('bad.xsd', '<xsd:schema'),
        packageFile('dtd.xsd', '<!DOCTYPE x><x/>'),
      ]),
    );
    // Package checks come before schema loading; deep.xsd (named by the data object) is absent.
    expect(t.issues.map((i) => [i.code, i.file])).toEqual([
      ['MISSING_FILE', 'manifest.xsf'],
      ['INVALID_XML', 'bad.xsd'],
      ['UNSAFE_XML', 'dtd.xsd'],
    ]);
    expect(t.schemas.main!.root.name).toBe('r');
  });

  test('a 257-deep secondary schema is an issue, and the main tree still builds', () => {
    const deep = `<xsd:schema ${XSD}>${'<xsd:annotation>'.repeat(256)}${'</xsd:annotation>'.repeat(256)}</xsd:schema>`;
    const t = parsePackage(withSchemas([packageFile('deep.xsd', deep)]));
    expect(t.issues.map((i) => [i.code, i.file, i.details?.limit])).toEqual([
      ['LIMIT_EXCEEDED', 'deep.xsd', 'xmlDepth'],
    ]);
    expect(t.schemas.main).toBeDefined();
    expect(t.schemas.secondary).toEqual({});
  });

  test('a manifest deeper than xmlDepth is fatal', () => {
    const files = minimalPackage(`${'<xsf:x>'.repeat(300)}${'</xsf:x>'.repeat(300)}`);
    expect(catchError(() => parsePackage(files)).code).toBe('LIMIT_EXCEEDED');
  });
});

describe('the result', () => {
  test('form 04: secondary trees keyed by data object name', async () => {
    const t = parsePackage(await sampleFiles('04-purchase-request'));
    expect(Object.keys(t.schemas.secondary)).toEqual(['Vendors', 'BudgetService']);
    expect(t.schemas.secondary.Vendors!.root.name).toBe('myFields');
    expect(t.schemas.main!.root.name).toBe('purchaseRequest');
  });

  test('form 47: codeFiles is ["script.js"]', async () => {
    expect(parsePackage(await sampleFiles('47-asset-checkout-script')).codeFiles).toEqual([
      'script.js',
    ]);
  });

  test('code files by extension, any case, listed or not', () => {
    const extra = ['Form.DLL', 'Form.pdb', 'macro.VBS', 'notes.txt'].map((n) =>
      packageFile(n, 'x'),
    );
    const t = parsePackage(minimalPackage('', { listed: extra.map((f) => f.name), extra }));
    expect(t.codeFiles).toEqual(['Form.DLL', 'Form.pdb', 'macro.VBS']);
  });

  test('parseXsn adds the cabinet; parsePackage of the same files gives the same rest', async () => {
    const cab = sampleCabinets().find((c) => c.slug === '05-new-hire-onboarding')!;
    const viaXsn = await parseXsn(readSample(cab.path));
    const viaPackage = parsePackage(await sampleFiles('05-new-hire-onboarding'));
    expect(viaXsn.cabinet).toMatchObject({ versionMajor: 1, versionMinor: 3 });
    expect(viaPackage).not.toHaveProperty('cabinet');
    expect({ ...viaXsn, cabinet: undefined }).toEqual({ ...viaPackage, cabinet: undefined });
  });

  test('no Uint8Array other than files[].bytes, and no functions (structured-clone safe)', async () => {
    for (const cab of sampleCabinets()) {
      const t = await parseXsn(readSample(cab.path));
      const found: string[] = [];
      const visit = (v: unknown, path: string) => {
        if (v instanceof Uint8Array) {
          if (!/^files\[\d+\]\.bytes$/.test(path)) found.push(path);
          return;
        }
        if (typeof v === 'function') found.push(`${path} (function)`);
        else if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`));
        else if (v && typeof v === 'object') {
          for (const [k, x] of Object.entries(v)) visit(x, path ? `${path}.${k}` : k);
        }
      };
      visit(t, '');
      expect(found, cab.slug).toEqual([]);
      expect(() => structuredClone(t)).not.toThrow();
    }
  });

  test('unknowns: manifest first, then schema files by name', () => {
    const files = minimalPackage('<x:a xmlns:x="urn:x"/>', {
      listed: ['b.xsd', 'a.xsd'],
      extra: [
        packageFile('b.xsd', `<xsd:schema ${XSD}><xsd:foo/></xsd:schema>`),
        packageFile('a.xsd', `<xsd:schema ${XSD}><xsd:bar/></xsd:schema>`),
      ],
    });
    expect(parsePackage(files).unknowns.map((u) => [u.file, u.name])).toEqual([
      ['manifest.xsf', 'a'],
      ['a.xsd', 'bar'],
      ['b.xsd', 'foo'],
    ]);
  });
});
