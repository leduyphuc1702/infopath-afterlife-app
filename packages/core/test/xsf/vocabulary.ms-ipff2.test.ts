import { describe, expect, test } from 'vitest';
import { MS_IPFF2 } from '../../src/xsf/ms-ipff2';
import { childKey, XSF_VOCABULARY, type ElementSpec } from '../../src/xsf/vocabulary';

// R13.8, design §8.1 and §8.5: the table only claims what MS-IPFF2 5.1–5.3 declare, at the same
// positions and with the same value spaces. The one kind of exception is a node marked
// `viaWildcard`, which MS-IPFF2 admits through a wildcard but does not name.

const table: [string, ElementSpec][] = Object.entries(XSF_VOCABULARY);

/** The qualified name an element at this position has: `xsf:rule`, or `xsf:exitRuleSet` for `xsf:rule/exitRuleSet`. */
function qnameOf(key: string): string {
  const slash = key.lastIndexOf('/');
  if (slash < 0) return key;
  return `${key.slice(0, key.indexOf(':'))}:${key.slice(slash + 1)}`;
}

/** Namespace of an attribute key: `{uri}local` → uri; a local name → null. */
function attrNamespace(name: string): string | null {
  return name.startsWith('{') ? name.slice(1, name.indexOf('}')) : null;
}

test('the table has positions to check', () => {
  expect(table.length).toBeGreaterThan(100);
});

describe.each(table)('%s', (key, spec) => {
  const ipff2 = MS_IPFF2[key];

  test('is an MS-IPFF2 position', () => {
    expect(ipff2, key).toBeDefined();
  });

  test('every attribute exists there with the same value space', () => {
    for (const [name, attr] of Object.entries(spec.attrs)) {
      if (typeof attr === 'object' && 'viaWildcard' in attr) {
        // Admitted by an xsd:anyAttribute whose namespace constraint covers the attribute.
        const ns = attrNamespace(name);
        const allowed = (ipff2!.anyAttribute ?? '').split(/\s+/);
        expect(ipff2!.attrs[name], `${key}/@${name} is named by MS-IPFF2`).toBeUndefined();
        expect(ns, `${key}/@${name} is qualified`).not.toBeNull();
        expect(
          allowed.includes('##any') || allowed.includes(ns!),
          `${key} anyAttribute (${ipff2!.anyAttribute}) admits ${name}`,
        ).toBe(true);
        continue;
      }
      expect(ipff2!.attrs[name], `${key}/@${name}`).toEqual(attr);
    }
  });

  test('every MS-IPFF2 attribute of the position is modelled (R7.5: all attributes kept)', () => {
    for (const name of Object.keys(ipff2!.attrs)) expect(spec.attrs, name).toHaveProperty([name]);
  });

  test('every child exists there under its own name', () => {
    for (const [qname, child] of Object.entries(spec.children)) {
      const target = childKey(child);
      expect(XSF_VOCABULARY, `${key} → ${target}`).toHaveProperty([target]);
      expect(qnameOf(target), `${key}: ${qname} → ${target}`).toBe(qname);
      if (typeof child === 'object') {
        // The only exception: a child admitted by an xsd:any wildcard on the parent.
        expect(child.viaWildcard).toBe(true);
        expect(target, `${target} is a global xsf2 or xsf3 element`).toMatch(/^xsf[23]:[^/]+$/);
        expect(MS_IPFF2[target], target).toBeDefined();
        expect(ipff2!.wildcard, `${key} content is a wildcard`).toBe(true);
        expect(ipff2!.children).not.toContain(target);
      } else {
        expect(ipff2!.children, `${key} → ${target}`).toContain(target);
      }
    }
  });

  test('content agrees with MS-IPFF2', () => {
    if (spec.content === 'text') expect(ipff2!.text, 'text content').toBe(true);
    if (spec.content === 'rawXml') expect(ipff2!.wildcard, 'a wildcard payload').toBe(true);
  });
});

describe('the exceptions', () => {
  test('viaWildcard children: exactly the two solution definitions inside xsf:extension', () => {
    const marked = table.flatMap(([key, spec]) =>
      Object.values(spec.children)
        .filter((c) => typeof c === 'object')
        .map((c) => `${key} → ${childKey(c)}`),
    );
    expect(marked).toEqual([
      'xsf:extension → xsf2:solutionDefinition',
      'xsf:extension → xsf3:solutionDefinition',
    ]);
  });

  test('viaWildcard attributes: exactly xd:autogeneration on xsf:editWith', () => {
    const marked = table.flatMap(([key, spec]) =>
      Object.entries(spec.attrs)
        .filter(([, a]) => typeof a === 'object' && 'viaWildcard' in a)
        .map(([name]) => `${key}/@${name}`),
    );
    expect(marked).toEqual([
      'xsf:editWith/@{http://schemas.microsoft.com/office/infopath/2003}autogeneration',
    ]);
  });
});

describe('shape', () => {
  test('sharepointListAdapterRW is spelled as in the MS-IPFF2 5.1 XSD', () => {
    expect(XSF_VOCABULARY).toHaveProperty(['xsf:sharepointListAdapterRW']);
    expect(XSF_VOCABULARY).not.toHaveProperty(['xsf:sharePointListAdapterRW']);
    expect(XSF_VOCABULARY['xsf:dataObject/query'].children).toHaveProperty([
      'xsf:sharepointListAdapterRW',
    ]);
  });

  test('every position is reachable from xsf:xDocumentClass', () => {
    const seen = new Set<string>();
    const stack = ['xsf:xDocumentClass'];
    while (stack.length) {
      const key = stack.pop()!;
      if (seen.has(key)) continue;
      seen.add(key);
      const spec: ElementSpec = XSF_VOCABULARY[key as keyof typeof XSF_VOCABULARY];
      for (const c of Object.values(spec.children)) stack.push(childKey(c));
    }
    expect(Object.keys(XSF_VOCABULARY).filter((k) => !seen.has(k))).toEqual([]);
  });

  test('a global element referenced from several parents is one key', () => {
    // xsf:errorMessage under errorCondition and override; xsf:printSettings under view and
    // mergedPrintView; xsf:ruleSetAction under four parents.
    const parents = (target: string) =>
      table
        .filter(([, s]) => Object.values(s.children).some((c) => childKey(c) === target))
        .map(([k]) => k);
    expect(parents('xsf:errorMessage')).toEqual(['xsf:errorCondition', 'xsf:override']);
    expect(parents('xsf:printSettings').sort()).toEqual(['xsf2:mergedPrintView', 'xsf:view']);
    expect(parents('xsf:ruleSetAction').sort()).toEqual([
      'xsf:domEventHandler',
      'xsf:onLoad',
      'xsf:submit',
      'xsf:unboundControls/button',
    ]);
    expect(parents('xsf:field')).toEqual(['xsf:fields']);
    expect(parents('xsf:fields')).toEqual(['xsf:listProperties']);
  });
});
