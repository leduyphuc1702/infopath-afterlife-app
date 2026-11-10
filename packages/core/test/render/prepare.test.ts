import { beforeAll, expect, test } from 'vitest';
import { AfterlifeError, buildFormIR, parseXsn, prepareView, type FormIR } from '../../src/index';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { catchRejection } from '../helpers/catch-error';
import { readSample, sampleCabinets } from '../helpers/samples';
import { viewIR } from '../helpers/view-package';

// Spec 03 R1.2 (default view) and R1.3 (views that cannot be rendered), at prepareView.

const forms = new Map<string, { t: ParsedTemplate; ir: FormIR }>();
beforeAll(async () => {
  for (const c of sampleCabinets()) {
    const t = await parseXsn(readSample(c.path));
    forms.set(c.slug, { t, ir: buildFormIR(t) });
  }
});
const form = (slug: string) => forms.get(slug)!;

test('with no view name, the FormIR default view is prepared (R1.2)', async () => {
  const f05 = form('05-new-hire-onboarding');
  const f03 = form('03-travel-request');
  expect((await prepareView(f05.t, f05.ir)).view.name).toBe('HR');
  expect((await prepareView(f03.t, f03.ir)).view.name).toBe('Employee');
});

test('a named view is prepared', async () => {
  const f03 = form('03-travel-request');
  const names = f03.ir.views.map((v) => v.name);
  expect(names.length).toBeGreaterThan(1);
  for (const name of names)
    expect((await prepareView(f03.t, f03.ir, { view: name })).view.name).toBe(name);
});

test('every view of the 48 samples prepares with no issue', async () => {
  let count = 0;
  for (const [slug, { t, ir }] of forms) {
    for (const v of ir.views) {
      const prepared = await prepareView(t, ir, { view: v.name });
      expect(prepared.issues, `${slug} ${v.name}`).toEqual([]);
      expect(Object.isFrozen(prepared)).toBe(true);
      count++;
    }
  }
  expect(count).toBe(53);
});

test('an unknown view name is VIEW_NOT_RENDERABLE (unknown)', async () => {
  const f01 = form('01-leave-request');
  const err = await prepareView(f01.t, f01.ir, { view: 'Manager' }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AfterlifeError);
  expect(err).toMatchObject({
    code: 'VIEW_NOT_RENDERABLE',
    details: { view: 'Manager', reason: 'unknown' },
  });
});

test("spec 02's missing and broken views are VIEW_NOT_RENDERABLE, with no partial result", async () => {
  const { t, ir } = viewIR([
    { name: 'Missing', file: 'missing.xsl', missing: true },
    { name: 'Broken', file: 'broken.xsl' },
    { name: 'Good', file: 'dropdown-case.xsl' },
  ]);
  for (const [view, reason] of [
    ['Missing', 'missing'],
    ['Broken', 'unparsed'],
  ] as const) {
    const err = await prepareView(t, ir, { view }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'VIEW_NOT_RENDERABLE', details: { view, reason } });
    expect((err as Error).message).toMatch(/^[\x20-\x7e]+$/);
  }
  expect((await prepareView(t, ir, { view: 'Good' })).view.name).toBe('Good');
});

test('a form with no views has no default view to prepare', async () => {
  const { t, ir } = viewIR([{ name: 'Good', file: 'dropdown-case.xsl' }]);
  const none: FormIR = { ...ir, views: [] };
  const err = await prepareView(t, none).catch((e: unknown) => e);
  expect(err).toMatchObject({
    code: 'VIEW_NOT_RENDERABLE',
    details: { view: '', reason: 'unknown' },
  });
});

test('a view XSL over viewXmlBytes is LIMIT_EXCEEDED', async () => {
  const f08 = form('08-big-form');
  const err = await prepareView(f08.t, f08.ir, { viewXmlBytes: 1024 }).catch((e: unknown) => e);
  expect(err).toMatchObject({ code: 'LIMIT_EXCEEDED', details: { limit: 'xmlBytes', max: 1024 } });
});

test('prepareView reports errors as rejections, never as synchronous throws', async () => {
  const f01 = form('01-leave-request');
  let promise: Promise<unknown> | undefined;
  expect(() => {
    promise = prepareView(f01.t, f01.ir, { view: 'nope' });
  }).not.toThrow();
  expect(await catchRejection(promise!)).toMatchObject({ code: 'VIEW_NOT_RENDERABLE' });
});
