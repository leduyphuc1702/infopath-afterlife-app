import fc from 'fast-check';
import { expect, test } from 'vitest';
import {
  AfterlifeError,
  buildFormIR,
  prepareView,
  renderView,
  type PreparedView,
} from '../../src/index';
import { viewCases, type ViewCase } from '../helpers/render-cases';
import { p4Input, replaceText, type P4Input } from './p4-inputs';
import { P4_REGRESSIONS } from './regressions';

// Property P4 (spec 03 R7.1, design §10): rendering is deterministic. Each run renders 2–3 of the
// 53 views, with records whose text values are generated, three times: in the given order with
// views prepared once for the whole property; in a permuted order with views prepared afresh for
// the run; and in the permuted order again with the first views. All three give the same bytes
// per render (the result's JSON, or the error's code and details). Node/Worker identity is the
// task 9 parity test (R5.3).

const RUNS = 200;
const cases = await viewCases();
const dec = new TextDecoder();
const enc = new TextEncoder();
const recordText = new Map(
  cases.flatMap((c) =>
    (['empty', 'first'] as const).map((r) => [`${c.id} ${r}`, dec.decode(c.records[r])] as const),
  ),
);

const prepare = (c: ViewCase) => prepareView(c.t, buildFormIR(c.t), { view: c.view });
const shared = new Map<string, Promise<PreparedView>>();
const sharedOf = (c: ViewCase) => {
  if (!shared.has(c.id)) shared.set(c.id, prepare(c));
  return shared.get(c.id)!;
};

/** How often each shape occurred, so the property cannot pass vacuously. */
const seen = { nonBmp: 0, long: 0, markup: 0, quotes: 0, notEnUs: 0, threw: 0, renders: 0 };

function bytesOf(prepared: PreparedView, input: P4Input, record: Uint8Array): string {
  try {
    const r = renderView(prepared, {
      record,
      now: input.now,
      locale: input.locale,
      userName: input.userName,
    });
    return JSON.stringify(r);
  } catch (e) {
    if (!(e instanceof AfterlifeError)) throw e;
    seen.threw++;
    const { code, details } = e as { code: string; details: unknown };
    return JSON.stringify({ error: code, details });
  }
}

async function check(input: P4Input): Promise<void> {
  const items = input.renders.map((r) => {
    const c = cases[r.view % cases.length]!;
    const text = replaceText(recordText.get(`${c.id} ${r.record}`)!, r);
    if (/[\u{10000}-\u{10FFFF}]/u.test(text)) seen.nonBmp++;
    if (r.values.some((v) => v.length >= 1000)) seen.long++;
    if (text.includes('&lt;')) seen.markup++;
    if (/["']/.test(r.values.join(''))) seen.quotes++;
    return { c, record: enc.encode(text) };
  });
  if (input.locale !== 'en-US') seen.notEnUs++;
  seen.renders += items.length;

  const first: string[] = [];
  for (const it of items) first.push(bytesOf(await sharedOf(it.c), input, it.record));
  const fresh = new Map<string, PreparedView>();
  for (const i of input.order) {
    const it = items[i]!;
    if (!fresh.has(it.c.id)) fresh.set(it.c.id, await prepare(it.c));
    expect(bytesOf(fresh.get(it.c.id)!, input, it.record), `fresh, ${it.c.id}`).toBe(first[i]);
  }
  for (const i of input.order) {
    const it = items[i]!;
    expect(bytesOf(await sharedOf(it.c), input, it.record), `again, ${it.c.id}`).toBe(first[i]);
  }
}

test('the generated record keeps the sample shape: same tags, new text', () => {
  const xml =
    '<?mso-x a="1"?>\n<my:r xmlns:my="urn:my">\n  <my:a>old</my:a><my:b>x</my:b>\n</my:r>';
  expect(replaceText(xml, { values: ['<&>\r'], keep: 0 })).toBe(
    '<?mso-x a="1"?>\n<my:r xmlns:my="urn:my">\n  <my:a>&lt;&amp;&gt;&#13;</my:a><my:b>&lt;&amp;&gt;&#13;</my:b>\n</my:r>',
  );
  expect(replaceText(xml, { values: ['n'], keep: 1 })).toContain('<my:a>n</my:a><my:b>x</my:b>');
});

test(`${RUNS} runs: same bytes twice, in any view order, prepared once or afresh`, async () => {
  await fc.assert(fc.asyncProperty(p4Input, check), { numRuns: RUNS });
  console.log(`P4 coverage: ${JSON.stringify(seen)}`);
  expect(seen.renders).toBeGreaterThanOrEqual(2 * RUNS);
  for (const k of ['nonBmp', 'long', 'markup', 'quotes', 'notEnUs'] as const) {
    expect(seen[k], k).toBeGreaterThan(RUNS / 10);
  }
}, 120_000);

test.each(P4_REGRESSIONS.map((r) => [r.note, r.case] as const))('regression: %s', async (_n, p) => {
  await check(p);
});
