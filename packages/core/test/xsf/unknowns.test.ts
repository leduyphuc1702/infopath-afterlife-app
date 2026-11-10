import { describe, expect, test } from 'vitest';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { sampleManifests } from '../helpers/manifests';

// R13.1, R13.2, R13.7, R13.8, R13.9 end to end through the builders: nodes inserted into a real
// manifest (form 05) at known paths come out as unknown entries at those paths.

const manifests = await sampleManifests();
const form05 = new TextDecoder().decode(
  manifests.find((m) => m.slug === '05-new-hire-onboarding')!.bytes,
);
const R = '/xsf:xDocumentClass[1]';

const parse = (text: string) => parseManifest(new TextEncoder().encode(text));

/** Replaces the one occurrence of `find` in form 05. */
function edit(text: string, find: string, replace: string): string {
  expect(text.split(find)).toHaveLength(2);
  return text.replace(find, replace);
}

test('form 05 as it is: no unknown entries and no issues', () => {
  const { unknowns, issues } = parse(form05);
  expect(unknowns).toEqual([]);
  expect(issues).toEqual([]);
});

describe('an unknown element and an unknown attribute', () => {
  let text = edit(
    form05,
    '<xsf:views default="HR">',
    '<xsf:views default="HR"><x:extra xmlns:x="urn:x" a="1"><x:deep/></x:extra>',
  );
  text = edit(
    text,
    '<xsf:view name="IT" caption="IT">',
    '<xsf:view name="IT" caption="IT" bogus="1">',
  );
  const { manifest, unknowns } = parse(text);

  test('each appears once, at its path, in document order', () => {
    expect(unknowns.map((u) => [u.kind, u.reason, u.path, u.raw, u.documented])).toEqual([
      [
        'element',
        'notModelled',
        `${R}/xsf:views[1]/{urn:x}extra[1]`,
        '<x:extra xmlns:x="urn:x" a="1"><x:deep/></x:extra>',
        false,
      ],
      ['attribute', 'notModelled', `${R}/xsf:views[1]/xsf:view[2]/@bogus`, 'bogus="1"', false],
    ]);
  });

  test('the rest of the form is unchanged', () => {
    expect(manifest.views.map((v) => v.attrs.name)).toEqual(['HR', 'IT', 'Manager']);
    expect(manifest.views[1]!.attrs).toEqual({ name: 'IT', caption: 'IT' });
  });
});

test('MS-IPFF2 elements left out on purpose report documented: true', () => {
  const text = edit(
    form05,
    '</xsf:xDocumentClass>',
    `<xsf:taskpane caption="Help" href="help.htm"/>
<xsf:featureRestrictions><xsf:print ui="disabled"/></xsf:featureRestrictions>
</xsf:xDocumentClass>`,
  );
  const { unknowns } = parse(text);
  expect(unknowns.map((u) => [u.name, u.reason, u.documented])).toEqual([
    ['taskpane', 'notModelled', true],
    ['featureRestrictions', 'notModelled', true],
  ]);
});

test('a second copy of a held-once element: one repeated entry, one issue, the first still modelled', () => {
  const fileNew = `<xsf:fileNew>
		<xsf:initialXmlDocument caption="New Hire Onboarding" href="template.xml"></xsf:initialXmlDocument>
	</xsf:fileNew>`;
  const text = edit(
    form05,
    fileNew,
    `${fileNew}<xsf:fileNew><xsf:initialXmlDocument caption="Copy" href="copy.xml"/></xsf:fileNew>`,
  );
  const { manifest, unknowns, issues } = parse(text);
  expect(manifest.fileNew!.attrs.caption).toBe('New Hire Onboarding');
  expect(unknowns.map((u) => [u.reason, u.path, u.documented])).toEqual([
    ['repeated', `${R}/xsf:fileNew[2]`, true],
  ]);
  expect(issues.map((i) => [i.code, i.details])).toEqual([
    ['REPEATED_ELEMENT', { element: 'xsf:fileNew', parent: R, allowed: 1, rule: 'MS-IPFF2' }],
  ]);
});
