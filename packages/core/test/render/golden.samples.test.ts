import { describe, expect, test } from 'vitest';
import { buildFormIR, prepareView, renderView } from '../../src/index';
import { viewCases } from '../helpers/render-cases';
import { GOLDEN_INPUT, renderGoldenPath } from '../helpers/render-golden';
import { goldenText, snapshot } from '../helpers/snapshot';

// Spec 03 design §10: render goldens `{html, css, issues, marks}` under test/golden/render/, one
// per view and record. Task 4 writes form 01's default view (the thin slice); task 9 adds the
// other 52 views. test/browser/render-slice.browser.test.ts compares a Worker with these files.

const SLICE = ['01-leave-request/view1.xsl'];

const cases = (await viewCases()).filter((c) => SLICE.includes(c.id));

describe.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
  test.each(['empty', 'first'] as const)('%s record', async (record) => {
    const t = c.t;
    const prepared = await prepareView(t, buildFormIR(t), { view: c.view });
    const result = renderView(prepared, { ...GOLDEN_INPUT, record: c.records[record] });
    await expect(goldenText(await snapshot(result))).toMatchFileSnapshot(
      `../${renderGoldenPath(c.slug, c.xslFile, record)}`,
    );
  });
});

test('the slice is form 01 only until task 9', () => {
  expect(cases.map((c) => c.id)).toEqual(SLICE);
});
