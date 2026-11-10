import { describe, expect, test } from 'vitest';
import {
  compactPath,
  dataStep,
  IdRegistry,
  manifestId,
  nodeId,
  viewElementId,
} from '../../src/ir/ids';

// Spec 02 R13.2, design §4.

const MY = 'http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:00:00';

describe('data paths and node ids', () => {
  test('worked example 1: form 04 line total and form 03 Locations @code', () => {
    const ns = { xsf: 'urn:xsf', my: MY };
    const path = `/${['purchaseRequest', 'lines', 'line', 'lineTotal']
      .map((l) => dataStep(MY, l, 'element', ns))
      .join('/')}`;
    expect(nodeId('f', 'main', path)).toBe(
      'f:main:/my:purchaseRequest/my:lines/my:line/my:lineTotal',
    );
    const loc = `/${dataStep(null, 'locations', 'element', ns)}/${dataStep(null, 'country', 'element', ns)}/${dataStep(null, 'code', 'attribute', ns)}`;
    expect(nodeId('f', 'Locations', loc)).toBe('f:Locations:/locations/country/@code');
  });

  test('the first non-empty prefix bound to the namespace wins; the default prefix never', () => {
    expect(dataStep('urn:a', 'x', 'element', { '': 'urn:a', b: 'urn:a', c: 'urn:a' })).toBe('b:x');
  });

  test('a namespace with no prefix is {uri}local', () => {
    expect(dataStep('urn:a', 'x', 'attribute', { '': 'urn:a' })).toBe('@{urn:a}x');
  });
});

describe('manifest and view ids', () => {
  test('worked example 2: form 04 rule and query action', () => {
    const rule = '/xsf:xDocumentClass[1]/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]';
    expect(manifestId('rule', rule)).toBe('rule:/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]');
    expect(manifestId('action', `${rule}/xsf:queryAction[1]`)).toBe(
      'action:/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]/xsf:queryAction[1]',
    );
  });

  test('view paths: the root step dropped (braces kept whole), xsl: and xd: written short', () => {
    const XSL = '{http://www.w3.org/1999/XSL/Transform}';
    const path = `/${XSL}stylesheet[1]/${XSL}template[1]/html[1]/body[1]/span[2]/@{http://schemas.microsoft.com/office/infopath/2003}binding`;
    expect(compactPath(path)).toBe('/xsl:template[1]/html[1]/body[1]/span[2]/@xd:binding');
    expect(
      viewElementId('ctl', 'view1.xsl', `/${XSL}stylesheet[1]/${XSL}template[1]/span[1]`),
    ).toBe('ctl:view1.xsl:/xsl:template[1]/span[1]');
  });
});

test('IdRegistry: a repeat gets #2 and a DUPLICATE_ID issue', () => {
  const r = new IdRegistry();
  expect(r.claim('rule:/a')).toBe('rule:/a');
  expect(r.claim('rule:/a', { file: 'm', path: '/p', line: 3, column: 4 })).toBe('rule:/a#2');
  expect(r.claim('rule:/a')).toBe('rule:/a#3');
  expect(r.issues.map((i) => [i.code, i.details?.assigned, i.line])).toEqual([
    ['DUPLICATE_ID', 'rule:/a#2', 3],
    ['DUPLICATE_ID', 'rule:/a#3', undefined],
  ]);
});
