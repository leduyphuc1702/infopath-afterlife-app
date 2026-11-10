import { describe, expect, test } from 'vitest';
import { DEFAULT_LIMITS } from '../../src/limits';
import { parseXml, xmlContext } from '../../src/xml/parse';
import { XSF_VOCABULARY } from '../../src/xsf/vocabulary';
import { walkManifest } from '../../src/xsf/walk';
import { sampleManifests } from '../helpers/manifests';

// R13.6 at the walker level, before the builders exist: walking the manifest of every
// samples/own/ form and of the public sample gives zero unknown entries.

const manifests = await sampleManifests();

test('48 manifests: 47 own forms and the public sample', () => {
  expect(manifests).toHaveLength(48);
  expect(manifests.filter((m) => m.own)).toHaveLength(47);
});

describe.each(manifests.map((m) => [m.slug, m] as const))('%s', (_slug, m) => {
  test('zero unknown entries', () => {
    const { root } = parseXml(m.bytes, 'manifest.xsf', xmlContext(DEFAULT_LIMITS));
    const { unknowns } = walkManifest(root, 'manifest.xsf', XSF_VOCABULARY);
    expect(unknowns.map((u) => `${u.reason} ${u.path} ${u.raw.slice(0, 80)}`)).toEqual([]);
  });
});
