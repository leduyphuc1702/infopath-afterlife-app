import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { buildFormIR, parsePackage } from '../../src/index';
import { minimalPackage, packageFile, sampleFiles } from '../helpers/package';

// Spec 02 R1.1, R1.3, R10.

const sharepointXsd = readFileSync(
  new URL('../fixtures/synthetic/real-infopath/sharepoint-meta.xsd', import.meta.url),
);

test('R10: manifest unknowns are carried over deep-equal, in order', async () => {
  const files = (await sampleFiles('05-new-hire-onboarding')).map((f) =>
    f.name === 'manifest.xsf'
      ? packageFile(
          f.name,
          new TextDecoder()
            .decode(f.bytes)
            .replace(
              '</xsf:xDocumentClass>',
              '<xsf:externalViews/><xsf:x2 a="1"/></xsf:xDocumentClass>',
            ),
        )
      : f,
  );
  const t = parsePackage(files);
  expect(t.unknowns.length).toBe(2);
  expect(buildFormIR(t).unknowns).toEqual(t.unknowns);
});

test('R10: schema unknowns are carried over deep-equal, in order', () => {
  const t = parsePackage(
    minimalPackage(
      '<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:example:rooms sharepoint-meta.xsd"/></xsf:documentSchemas>',
      {
        listed: ['sharepoint-meta.xsd'],
        extra: [packageFile('sharepoint-meta.xsd', sharepointXsd)],
      },
    ),
  );
  expect(t.unknowns.length).toBe(3);
  const ir = buildFormIR(t);
  expect(ir.unknowns).toEqual(t.unknowns);
  expect(ir.fields.length).toBeGreaterThan(0);
});

test('R1.3: no main schema gives a FormIR with no fields and spec 01 issues first', () => {
  const t = parsePackage(minimalPackage());
  expect(t.schemas.main).toBeUndefined();
  const ir = buildFormIR(t);
  expect(ir.fields).toEqual([]);
  expect(ir.groups).toEqual([]);
  expect(ir.issues.slice(0, t.issues.length)).toEqual(t.issues);
  expect(ir.irVersion).toBe(1);
});
