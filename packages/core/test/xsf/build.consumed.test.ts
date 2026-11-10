import { describe, expect, test } from 'vitest';
import { BuildContext } from '../../src/xsf/build';
import type { XmlElement } from '../../src/xml/node';
import type { ModelNode } from '../../src/xsf/walk';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { catchError } from '../helpers/catch-error';
import { sampleManifests } from '../helpers/manifests';

// Design §8.3: a modelled node no builder takes is INTERNAL; `one` is only for positions MS-IPFF2
// allows once.

const node = (key: string, path: string, children: ModelNode[] = []): ModelNode => ({
  element: {} as XmlElement,
  key,
  path,
  file: 'manifest.xsf',
  line: 1,
  column: 1,
  attrs: {},
  children,
});

const R = '/xsf:xDocumentClass[1]';

describe('BuildContext', () => {
  test('a modelled child that no builder takes is INTERNAL with its path', () => {
    const rule = node('xsf:rule', `${R}/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]`);
    const ruleSet = node('xsf:ruleSet', `${R}/xsf:ruleSets[1]/xsf:ruleSet[1]`, [rule]);
    const ruleSets = node('xsf:ruleSets', `${R}/xsf:ruleSets[1]`, [ruleSet]);
    const ctx = new BuildContext(node('xsf:xDocumentClass', R, [ruleSets]));
    const sets = ctx.take(ctx.root, 'xsf:ruleSets');
    ctx.take(sets[0]!, 'xsf:ruleSet'); // the builder "forgets" the rules
    expect(catchError(() => ctx.assertAllConsumed())).toMatchObject({
      code: 'INTERNAL',
      details: { path: rule.path, reason: 'a modelled node was not consumed by any builder' },
    });
    ctx.take(ruleSet, 'xsf:rule');
    expect(() => ctx.assertAllConsumed()).not.toThrow();
  });

  test('one() refuses a position MS-IPFF2 allows more than once (a builder bug)', () => {
    const ctx = new BuildContext(node('xsf:views', `${R}/xsf:views[1]`));
    const e = catchError(() => ctx.one(ctx.root, 'xsf:view'));
    expect(e).toMatchObject({
      code: 'INTERNAL',
      details: {
        path: '/xsf:xDocumentClass[1]/xsf:views[1]',
        reason: 'one(xsf:view) on a position MS-IPFF2 does not hold once',
      },
    });
    expect(e.message).not.toContain('not consumed');
  });

  test('oneOf() refuses keys that are not one choice', () => {
    const ctx = new BuildContext(node('xsf:submit', `${R}/xsf:submit[1]`));
    expect(
      catchError(() => ctx.oneOf(ctx.root, ['xsf:emailAdapter', 'xsf:davAdapter'])),
    ).toMatchObject({
      code: 'INTERNAL',
      details: { reason: expect.stringContaining('is not one xsd:choice of xsf:submit') as string },
    });
  });
});

const manifests = await sampleManifests();

describe('every sample builds with every modelled node consumed', () => {
  test.each(manifests.map((m) => [m.slug, m.bytes] as const))('%s', (_slug, bytes) => {
    expect(() => parseManifest(bytes)).not.toThrow();
  });
});
