import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { MS_IPFF2, XD_YES_NO } from '../../src/xsf/ms-ipff2';

// R13.4 (enumeration source), R13.8 (documented source), design D6.

const source = readFileSync(new URL('../../src/xsf/ms-ipff2.ts', import.meta.url), 'utf8');
const header = source.slice(0, source.indexOf('export '));

describe('the header names the source', () => {
  test.each([
    ['5.1', '733aec6d-77b6-42e2-81af-ac3db2768ed9'],
    ['5.2', '5026480d-57f0-43f5-b6a0-0b7bdf6cb11e'],
    ['5.3', '2ea13fc9-3633-42bc-88c0-0b88120ddc00'],
  ])('section %s and its URL', (section, id) => {
    expect(header).toContain(`section ${section}`);
    expect(header).toContain(
      `https://learn.microsoft.com/en-us/openspecs/sharepoint_protocols/ms-ipff2/${id}`,
    );
  });

  test('a retrieval date and the Open Specifications statement', () => {
    expect(header).toMatch(/retrieved \d{4}-\d{2}-\d{2}/);
    expect(header).toContain('only element names, attribute names and enumeration values');
    expect(header).toContain('Microsoft Open Specifications notice');
  });
});

describe('known entries', () => {
  test('xsf:rule: caption, condition, isEnabled and the local exitRuleSet', () => {
    expect(MS_IPFF2['xsf:rule']).toMatchObject({
      attrs: { caption: 'string', condition: 'string', isEnabled: 'yesNo' },
    });
    expect(MS_IPFF2['xsf:rule']!.children).toContain('xsf:rule/exitRuleSet');
    expect(MS_IPFF2['xsf:rule/exitRuleSet']).toBeDefined();
  });

  test('xsf:signedDataBlock/@mode is single, cosign, countersign', () => {
    const mode = MS_IPFF2['xsf:signedDataBlock']!.attrs.mode;
    expect(mode).toEqual({
      enum: expect.arrayContaining(['single', 'cosign', 'countersign']) as string[],
    });
    expect((mode as { enum: string[] }).enum).toHaveLength(3);
  });

  test('the errorMessage of submit and of errorCondition are separate positions', () => {
    // submit declares a local errorMessage; errorCondition refers to the global xsf:errorMessage.
    expect(MS_IPFF2['xsf:submit']!.children).toContain('xsf:submit/errorMessage');
    expect(MS_IPFF2['xsf:submit/errorMessage']!.attrs).toEqual({});
    expect(MS_IPFF2['xsf:errorCondition']!.children).toContain('xsf:errorMessage');
    expect(MS_IPFF2['xsf:errorMessage']!.attrs).toEqual({
      shortMessage: 'string',
      type: { enum: ['modal', 'modeless'] },
    });
  });

  test('runtimeCompatibility is not an enumeration', () => {
    expect(MS_IPFF2['xsf2:solutionDefinition']!.attrs.runtimeCompatibility).toBe('string');
  });

  test('xdYesNo is yes and no', () => {
    expect(XD_YES_NO).toEqual(['yes', 'no']);
  });

  test('wildcards: xsf:extension holds only xsd:any and anyAttribute', () => {
    expect(MS_IPFF2['xsf:extension']).toEqual({
      attrs: { name: 'string' },
      children: [],
      text: true, // mixed="true"
      wildcard: true,
      anyAttribute: '##any',
    });
    // editWith admits any attribute in the InfoPath 2003 namespace (xd:autogeneration).
    expect(MS_IPFF2['xsf:editWith']!.anyAttribute).toBe(
      'http://schemas.microsoft.com/office/infopath/2003',
    );
    expect(MS_IPFF2['xsf:editWith']!.wildcard).toBeUndefined();
    expect(MS_IPFF2['xsf:rule']!.wildcard).toBeUndefined();
    expect(MS_IPFF2['xsf:rule']!.anyAttribute).toBeUndefined();
  });

  test('wildcard positions: four xsd:any and three untyped (xsd:anyType) elements', () => {
    const wild = Object.keys(MS_IPFF2).filter((k) => MS_IPFF2[k]!.wildcard);
    expect(wild.sort()).toEqual([
      'xsf:chooseFragment',
      'xsf:extension',
      'xsf:footer',
      'xsf:header',
      'xsf:useQueryAdapter',
      'xsf:useScriptHandler',
      'xsf:webPartConnectionAction',
    ]);
  });

  test('text content: simple types, simple content and mixed content', () => {
    expect(MS_IPFF2['xsf:dialogBoxMessageAction']!.text).toBe(true); // simple type
    expect(MS_IPFF2['xsf:errorMessage']!.text).toBe(true); // simple content
    expect(MS_IPFF2['xsf:submit/errorMessage']!.text).toBe(true); // xsd:string
    expect(MS_IPFF2['xsf:chooseFragment']!.text).toBe(true); // mixed
    expect(MS_IPFF2['xsf:rule']!.text).toBeUndefined();
    expect(MS_IPFF2['xsf:rule/exitRuleSet']!.text).toBeUndefined(); // empty complex type
  });

  test('sharepointListAdapterRW is spelled as in MS-IPFF2', () => {
    expect(MS_IPFF2['xsf:sharepointListAdapterRW']).toBeDefined();
    expect(MS_IPFF2['xsf:sharePointListAdapterRW']).toBeUndefined();
  });
});

describe('shape', () => {
  test('every child key is itself a position', () => {
    for (const [key, el] of Object.entries(MS_IPFF2)) {
      for (const child of el.children) expect(MS_IPFF2[child], `${key} → ${child}`).toBeDefined();
    }
  });

  test('keys are qualified names or parent/local paths', () => {
    for (const key of Object.keys(MS_IPFF2)) {
      expect(key).toMatch(/^xsf[23]?:[A-Za-z][\w.-]*(\/[A-Za-z][\w.-]*)*$/);
    }
  });

  test('the counts the design expects: about 95 yesNo and about 40 enumerations', () => {
    const attrs = Object.values(MS_IPFF2).flatMap((e) => Object.values(e.attrs));
    expect(attrs.filter((a) => a === 'yesNo').length).toBe(96);
    expect(attrs.filter((a) => typeof a === 'object').length).toBe(39);
  });
});

describe('only names and values', () => {
  test('no XSD text and no documentation', () => {
    expect(source).not.toContain('<xsd:');
    expect(source).not.toMatch(/documentation|annotation/i);
  });

  test('every string in the table is a name or an enumeration value', () => {
    const table = source.slice(source.indexOf('export const MS_IPFF2'));
    const strings = [...table.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
    for (const s of strings) expect(s).toMatch(/^[\w:./{}-]*$|^##any$|^InfoPath Design Mode$/);
    // The one value with spaces: xsf:applicationParameters/@application.
    expect(MS_IPFF2['xsf:applicationParameters']!.attrs.application).toEqual({
      enum: ['InfoPath Design Mode'],
    });
  });
});
