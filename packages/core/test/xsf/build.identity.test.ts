import { describe, expect, test } from 'vitest';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { catchError } from '../helpers/catch-error';
import { formNumber, sampleManifests } from '../helpers/manifests';
import { manifestBytes } from '../helpers/synthetic-manifest';

// R7.1–R7.6: identity, versions, runtime settings, package, schemas.

const manifests = await sampleManifests();
const parsed = new Map(manifests.map((m) => [m.slug, parseManifest(m.bytes).manifest]));
const form = (n: number) => {
  const slug = manifests.find((m) => m.own && formNumber(m.slug) === n)!.slug;
  return parsed.get(slug)!;
};

describe('R7.6 oracle', () => {
  test.each(manifests.filter((m) => m.own).map((m) => m.slug))(
    '%s: trustSetting="automatic" and no trustLevel',
    (slug) => {
      const attrs = parsed.get(slug)!.documentClass.attrs;
      expect(attrs.trustSetting).toBe('automatic');
      expect(attrs).not.toHaveProperty('trustLevel');
    },
  );

  test('public sample: trustLevel, productVersion, solutionFormatVersion', () => {
    const attrs = parsed.get('theill-weight-keeper')!.documentClass.attrs;
    expect(attrs).toMatchObject({
      trustLevel: 'restricted',
      productVersion: '11.0.6357',
      solutionFormatVersion: '1.100.0.0',
    });
  });

  test('public sample: InfoPath 2003 has no xsf2 solution definition', () => {
    const { solution } = parsed.get('theill-weight-keeper')!;
    expect(solution).toEqual({ runtimeCompatibility: [] });
  });
});

describe('R7.1 identity', () => {
  test('form 05: every xDocumentClass attribute as written, absent ones absent', () => {
    const m = form(5);
    expect(m.documentClass).toMatchObject({
      key: 'xsf:xDocumentClass',
      file: 'manifest.xsf',
      path: '/xsf:xDocumentClass[1]',
      line: 6,
    });
    expect(m.documentClass.attrs).toEqual({
      trustSetting: 'automatic',
      solutionFormatVersion: '2.0.0.0',
      solutionVersion: '1.0.0.1',
      productVersion: '15.0.0',
      name: 'urn:schemas-microsoft-com:office:infopath:New-Hire-Onboarding:-myXSD-2026-11-03T08-40-00',
      publishUrl: 'C:\\forms\\05-new-hire-onboarding.xsn',
    });
  });
});

describe('R7.2 solution definition', () => {
  test('form 43 runtimeCompatibility is ["client", "server"]', () => {
    expect(form(43).solution.runtimeCompatibility).toEqual(['client', 'server']);
    expect(form(43).solution.definition!.attrs.runtimeCompatibility).toBe('client server');
  });

  test('every other own form is ["client"]', () => {
    for (const m of manifests.filter((x) => x.own && formNumber(x.slug) !== 43)) {
      expect(parsed.get(m.slug)!.solution.runtimeCompatibility, m.slug).toEqual(['client']);
    }
  });

  test('form 05: server and offline attributes', () => {
    const { solution } = form(5);
    expect(solution.definition!.attrs).toEqual({
      runtimeCompatibility: 'client',
      allowClientOnlyCode: 'no',
    });
    expect(solution.server!.attrs).toEqual({
      isPreSubmitPostBackEnabled: 'no',
      formLocale: 'en-US',
      isMobileEnabled: 'no',
    });
    expect(solution.offline!.attrs).toEqual({ openIfQueryFails: 'yes', cacheQueries: 'yes' });
    expect(solution).not.toHaveProperty('xsf3');
  });

  test('synthetic xsf3: solution definition and baseUrl', () => {
    const { solution } = parseManifest(
      manifestBytes(`<xsf:extensions><xsf:extension name="SolutionDefinitionExtensions">
  <xsf2:solutionDefinition runtimeCompatibility=" client  server "/>
  <xsf3:solutionDefinition><xsf3:baseUrl relativeUrlBase="http://forms-legacy/" queryServerInfo="yes"/></xsf3:solutionDefinition>
</xsf:extension></xsf:extensions>`),
    ).manifest;
    expect(solution.runtimeCompatibility).toEqual(['client', 'server']);
    expect(solution.xsf3!.key).toBe('xsf3:solutionDefinition');
    expect(solution.baseUrl!.attrs).toEqual({
      relativeUrlBase: 'http://forms-legacy/',
      queryServerInfo: 'yes',
    });
  });

  test('two xsf2:solutionDefinition, even in two xsf:extension elements, are INVALID_XML', () => {
    const e = catchError(() =>
      parseManifest(
        manifestBytes(`<xsf:extensions>
  <xsf:extension name="a"><xsf2:solutionDefinition/></xsf:extension>
  <xsf:extension name="b"><xsf2:solutionDefinition/></xsf:extension>
</xsf:extensions>`),
      ),
    );
    expect(e).toMatchObject({
      code: 'INVALID_XML',
      details: { line: 5, reason: expect.stringContaining('xsf2:solutionDefinition') as string },
    });
  });
});

describe('R7.3 and R7.4: upgrade, package, schemas, fileNew, parameters', () => {
  test('form 05', () => {
    const m = form(5);
    expect(m.upgrade!.attrs).toEqual({
      transform: 'upgrade.xsl',
      minVersionToUpgrade: '0.0.0.0',
      maxVersionToUpgrade: '1.0.0.1',
    });
    expect(m.package.map((f) => f.attrs.name)).toEqual([
      'myschema.xsd',
      'template.xml',
      'sampledata.xml',
      'upgrade.xsl',
      'view1.xsl',
      'view2.xsl',
      'view3.xsl',
    ]);
    expect(m.package[0]!.properties.map((p) => [p.attrs.name, p.attrs.value])).toEqual([
      ['namespace', 'http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:40:00'],
      ['editability', 'full'],
      ['rootElement', 'onboarding'],
      ['useOnDemandAlgorithm', 'yes'],
    ]);
    expect(m.package[1]!.properties).toEqual([]);
    expect(m.documentSchemas.map((s) => s.attrs)).toEqual([
      {
        rootSchema: 'yes',
        location:
          'http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:40:00 myschema.xsd',
      },
    ]);
    expect(m.fileNew!.attrs).toEqual({ caption: 'New Hire Onboarding', href: 'template.xml' });
    expect(m.importParameters!.attrs).toEqual({ enabled: 'yes' });
    expect(m.applicationParameters).toHaveLength(1);
    expect(m.applicationParameters[0]!.attrs).toEqual({ application: 'InfoPath Design Mode' });
    expect(m.applicationParameters[0]!.solutionProperties!.attrs).toMatchObject({
      lastOpenView: 'view1.xsl',
      automaticallyCreateNodes: 'yes',
    });
  });

  test('every sample: one package entry per xsf:file, each with a name', () => {
    for (const [slug, m] of parsed) {
      expect(m.package.length, slug).toBeGreaterThan(0);
      for (const f of m.package) expect(f.attrs.name, slug).toBeDefined();
    }
  });

  test('the public sample keeps lastVersionNeedingTransform', () => {
    const props = parsed.get('theill-weight-keeper')!.applicationParameters[0]!.solutionProperties!;
    expect(props.attrs).toHaveProperty('lastVersionNeedingTransform');
  });

  test('an empty manifest root gives empty lists and no optional parts', () => {
    const m = parseManifest(manifestBytes('')).manifest;
    expect(m).toEqual({
      documentClass: expect.objectContaining({
        attrs: { solutionFormatVersion: '3.0.0.0' },
      }) as object,
      solution: { runtimeCompatibility: [] },
      package: [],
      documentSchemas: [],
      applicationParameters: [],
      views: [],
      unlinkedViewExtensions: [],
      ruleSets: [],
      bindings: [],
      domEventHandlers: [],
      calculations: [],
      validations: [],
      blankChecks: [],
      dataObjects: [],
      dataAdapters: [],
      connectionExtensions: [],
      containers: [],
    });
  });

  test('a second xsf:fileNew is INVALID_XML at the second, naming the rule', () => {
    const e = catchError(() => parseManifest(manifestBytes('<xsf:fileNew/>\n  <xsf:fileNew/>')));
    expect(e).toMatchObject({
      code: 'INVALID_XML',
      details: {
        file: 'manifest.xsf',
        line: 4,
        column: 3,
        reason:
          'xsf:fileNew occurs 2 times in /xsf:xDocumentClass[1]; MS-IPFF2 allows xsf:fileNew once here',
      },
    });
  });
});

describe('containers', () => {
  test('form 05: grouping elements in document order, with attributes', () => {
    const m = form(5);
    const containers = m.containers.map((c) => [c.key, c.line]);
    const lines = containers.map(([, line]) => line as number);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
    expect(m.containers.find((c) => c.key === 'xsf:views')!.attrs).toEqual({ default: 'HR' });
    expect(m.containers.find((c) => c.key === 'xsf:extension')!.attrs).toEqual({
      name: 'SolutionDefinitionExtensions',
    });
    expect(new Set(m.containers.map((c) => c.key))).toEqual(
      new Set([
        'xsf:package',
        'xsf:files',
        'xsf:fileProperties',
        'xsf:documentVersionUpgrade',
        'xsf:extensions',
        'xsf:extension',
        'xsf2:viewsExtension',
        'xsf:views',
        'xsf:editing',
        'xsf:fragmentToInsert',
        'xsf:unboundControls',
        'xsf:documentSchemas',
        'xsf:fileNew',
        'xsf:ruleSets',
        'xsf:calculations',
        'xsf:domEventHandlers',
        'xsf:customValidation',
        'xsf2:dataConnections',
      ]),
    );
  });
});
