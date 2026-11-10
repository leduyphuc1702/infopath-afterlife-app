import { describe, expect, test } from 'vitest';
import { buildFormIR, parsePackage } from '../../src/index';
import { generationOf } from '../../src/ir/meta';
import { sampleTemplates } from '../helpers/formir';
import { packageFile } from '../helpers/package';
import { manifestXml } from '../helpers/synthetic-manifest';

// Spec 02 R2.

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
const form = (n: number) => samples.find((s) => s.form === n)!.ir;
const synthetic = (rootAttrs: string, inner = '') =>
  buildFormIR(parsePackage([packageFile('manifest.xsf', manifestXml(inner, rootAttrs))])).meta;

describe('R2.1 identity', () => {
  test('form 01: name from the initialXmlDocument caption, URN and versions as written', () => {
    expect(form(1).meta).toMatchObject({
      name: 'Leave Request',
      nameSource: 'caption',
      urn: 'urn:schemas-microsoft-com:office:infopath:Leave-Request:-myXSD-2026-11-03T08-00-00',
      productVersion: '15.0.0',
      solutionFormatVersion: '2.0.0.0',
      publishUrl: 'C:\\forms\\01-leave-request.xsn',
    });
  });

  test('browserCompatible for form 43 only', () => {
    expect(samples.filter((s) => s.ir.meta.browserCompatible).map((s) => s.form)).toEqual([43]);
  });

  test('without a caption the name comes from the URN; without either it is empty', () => {
    expect(
      synthetic('name="urn:schemas-microsoft-com:office:infopath:Room-Booking:-myXSD-2026"'),
    ).toMatchObject({ name: 'Room-Booking', nameSource: 'urn' });
    expect(synthetic('name="urn:x"')).toMatchObject({ name: '', nameSource: 'none' });
  });
});

describe('R2.2 generation', () => {
  test('the public sample is 2003, the 47 own forms are 2013', () => {
    expect(samples.filter((s) => s.form === undefined).map((s) => s.ir.meta.generation)).toEqual([
      '2003',
    ]);
    expect(new Set(samples.filter((s) => s.form).map((s) => s.ir.meta.generation))).toEqual(
      new Set(['2013']),
    );
  });

  test.each([
    ['11.0.5329', '2003'],
    ['11.0.6357', '2003'],
    ['12.0.0', '2007'],
    ['14.0.0', '2010'],
    ['15.0.0', '2013'],
    ['16.0', 'unknown'],
    ['13.0', 'unknown'],
    ['x15', 'unknown'],
    [undefined, 'unknown'],
  ])('productVersion %s → %s', (pv, generation) => {
    expect(generationOf(pv)).toBe(generation);
  });

  test('solutionFormatVersion does not change the generation; the evidence is the attribute', () => {
    const m = synthetic('productVersion="15.0.0" solutionFormatVersion="2.0.0.0"');
    expect(m.generation).toBe('2013');
    expect(m.generationEvidence!.path).toBe('/xsf:xDocumentClass[1]/@productVersion');
    expect(synthetic('solutionFormatVersion="3.0.0.0"')).not.toHaveProperty('generationEvidence');
  });
});
