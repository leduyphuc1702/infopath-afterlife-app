import { afterAll, describe, expect, test } from 'vitest';
import { buildFormIR, prepareView, renderView, type Issue } from '../../src/index';
import { viewCases } from '../helpers/render-cases';
import { GOLDEN_INPUT, renderGoldenPath } from '../helpers/render-golden';
import { goldenText, snapshot } from '../helpers/snapshot';

// Spec 03 task 9 (R1.1, R3.1, design §10): render goldens `{html, css, issues, marks}` under
// test/golden/render/, one per view of the 53 and per record (empty and first), 106 files.
// test/browser/render-parity.browser.test.ts compares a Worker with these files (R5.3).

const cases = await viewCases();
const RECORDS = ['empty', 'first'] as const;

/** Issues of every render, by render id, for the totals at the end. */
const seen = new Map<string, { own: boolean; issues: readonly Issue[] }>();

describe.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
  test.each(RECORDS)('%s record', async (record) => {
    const t = c.t;
    const prepared = await prepareView(t, buildFormIR(t), { view: c.view });
    const result = renderView(prepared, { ...GOLDEN_INPUT, record: c.records[record] });
    seen.set(`${c.id} ${record}`, { own: c.own, issues: result.issues });
    await expect(goldenText(await snapshot(result))).toMatchFileSnapshot(
      `../${renderGoldenPath(c.slug, c.xslFile, record)}`,
    );
  });
});

test('53 views, 106 renders, none throws', () => {
  expect(cases).toHaveLength(53);
  expect(seen.size).toBe(106);
});

const ofCode = (code: string) =>
  [...seen].flatMap(([id, r]) =>
    r.issues.filter((i) => i.code === code).map((i) => ({ id, own: r.own, details: i.details })),
  );

test('no render calls an unimplemented function (R4.4)', () => {
  expect(ofCode('UNKNOWN_FUNCTION')).toEqual([]);
});

test('no own render removes content (§8.4: InfoPath runtime constructs go silently)', () => {
  expect(ofCode('CONTENT_REMOVED').filter((r) => r.own)).toEqual([]);
});

test('every control the view binds gets a mark (§9.1)', () => {
  expect(ofCode('CONTROL_NOT_MARKED')).toEqual([]);
});

// The task 9 report: issue codes by count, and CONTENT_REMOVED by kind.
afterAll(() => {
  const byCode = new Map<string, number>();
  const removed = new Map<string, number>();
  for (const r of seen.values()) {
    for (const i of r.issues) {
      byCode.set(i.code, (byCode.get(i.code) ?? 0) + 1);
      if (i.code === 'CONTENT_REMOVED') {
        const d = i.details as { kind: string; count: number };
        const key = `${r.own ? 'own' : 'public'} ${d.kind}`;
        removed.set(key, (removed.get(key) ?? 0) + d.count);
      }
    }
  }
  console.log(
    [
      `renders: ${seen.size}`,
      `issues by code: ${JSON.stringify(Object.fromEntries(byCode))}`,
      `CONTENT_REMOVED by kind: ${JSON.stringify(Object.fromEntries(removed))}`,
    ].join('\n'),
  );
});
