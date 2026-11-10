import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AfterlifeError, buildFormIR, prepareView, renderView } from '../../src/index';
import { DEFAULT_RENDER_LIMITS, type RenderLimits } from '../../src/limits';
import { STRING_CHARS_PER_STEP } from '../../src/render/engine/budget';
import type { FunctionTable } from '../../src/render/engine/host';
import { functionTable } from '../../src/render/functions';
import { catchError } from '../helpers/catch-error';
import { compileText, runCompiled } from '../helpers/engine';
import { viewCases, type ViewCase } from '../helpers/render-cases';

// Spec 03 task 5 (R3.3, design §5.3 and §6): each bomb stops with LIMIT_EXCEEDED naming its
// limit, at the defaults, and no HTML is returned. AFTERLIFE_BOMB_TIMES=1 prints how long each
// takes to reach its limit.

const MiB = 1024 * 1024;
const XSL = 'http://www.w3.org/1999/XSL/Transform';
const sheet = (templates: string, ns = '') =>
  `<xsl:stylesheet version="1.0" xmlns:xsl="${XSL}"${ns}><xsl:output method="html"/>${templates}</xsl:stylesheet>`;
const root = (body: string) => `<xsl:template match="/">${body}</xsl:template>`;

const times = new Map<string, number>();
afterAll(() => {
  if (process.env.AFTERLIFE_BOMB_TIMES) {
    for (const [name, ms] of times) console.log(`${name}: ${ms.toFixed(0)} ms`);
  }
});

/** Runs the bomb at the given limits; returns the error it must throw. */
async function explode(
  name: string,
  xsl: string,
  record: string,
  options: { limits?: Partial<RenderLimits>; functions?: FunctionTable } = {},
): Promise<AfterlifeError> {
  const view = await compileText(xsl);
  const start = performance.now();
  const e = catchError(() => runCompiled(view, record, options));
  times.set(name, performance.now() - start);
  expect(e).toBeInstanceOf(AfterlifeError);
  return e;
}

const limitOf = (e: AfterlifeError) => [e.code, (e.details as { limit?: string }).limit];

describe('bombs, at the default limits', () => {
  test('infinite recursion: templateDepth, at 129', async () => {
    const e = await explode(
      'infinite recursion',
      sheet(
        root('<xsl:call-template name="t"/>') +
          '<xsl:template name="t"><b><xsl:call-template name="t"/></b></xsl:template>',
      ),
      '<r/>',
    );
    expect(e.details).toEqual({ limit: 'templateDepth', max: 128, observed: 129 });
  });

  test('infinite recursion through apply-templates and built-in rules: templateDepth', async () => {
    const e = await explode(
      'apply-templates recursion',
      sheet('<xsl:template match="/|*"><xsl:apply-templates select="/"/></xsl:template>'),
      '<r/>',
    );
    expect(limitOf(e)).toEqual(['LIMIT_EXCEEDED', 'templateDepth']);
  });

  test('nested for-each bomb (100^4 iterations): evaluationSteps', async () => {
    const loops = (n: number): string =>
      n === 0 ? '<xsl:if test="0"/>' : `<xsl:for-each select="/r/a">${loops(n - 1)}</xsl:for-each>`;
    const e = await explode(
      'nested for-each',
      sheet(root(loops(4))),
      `<r>${'<a/>'.repeat(100)}</r>`,
    );
    expect(e.details).toMatchObject({ limit: 'evaluationSteps', max: 200_000 });
  });

  test('output bomb (400 × 100,000 characters): outputBytes', async () => {
    const e = await explode(
      'output',
      sheet(
        root(
          '<xsl:for-each select="/r/i"><xsl:for-each select="/r/i"><xsl:value-of select="/r/t"/></xsl:for-each></xsl:for-each>',
        ),
      ),
      `<r><t>${'x'.repeat(100_000)}</t>${'<i/>'.repeat(20)}</r>`,
    );
    expect(e.details).toMatchObject({ limit: 'outputBytes', max: 4 * MiB });
  });

  test('copy-of bomb (1,000 copies of a 1,001-node record): outputBytes', async () => {
    const e = await explode(
      'copy-of',
      sheet(root('<xsl:for-each select="/r/e"><xsl:copy-of select="/r"/></xsl:for-each>')),
      `<r>${'<e a="x"/>'.repeat(1000)}</r>`,
    );
    expect(e.details).toMatchObject({ limit: 'outputBytes', max: 4 * MiB });
  });

  test('string-doubling bomb, concat($s, $s): evaluationSteps before 64 MiB is built', async () => {
    const e = await explode(
      'string doubling',
      sheet(
        root(
          '<xsl:call-template name="d"><xsl:with-param name="s" select="\'x\'"/></xsl:call-template>',
        ) +
          '<xsl:template name="d"><xsl:param name="s"/>' +
          '<xsl:call-template name="d"><xsl:with-param name="s" select="concat($s, $s)"/></xsl:call-template>' +
          '</xsl:template>',
      ),
      '<r/>',
    );
    const { limit, observed } = e.details as { limit: string; observed: number };
    expect(limit).toBe('evaluationSteps');
    // Every string built was charged; together they hold fewer than 32 Mi characters, so none
    // reached 64 MiB as UTF-16.
    expect(observed * STRING_CHARS_PER_STEP).toBeLessThan(32 * MiB);
  });

  test('fragment-doubling bomb, copy-of $x twice into a new variable: outputBytes before 64 MiB', async () => {
    const e = await explode(
      'fragment doubling',
      sheet(
        root(
          '<xsl:call-template name="f"><xsl:with-param name="x"><b>x</b></xsl:with-param></xsl:call-template>',
        ) +
          '<xsl:template name="f"><xsl:param name="x"/>' +
          '<xsl:variable name="y"><xsl:copy-of select="$x"/><xsl:copy-of select="$x"/></xsl:variable>' +
          '<xsl:call-template name="f"><xsl:with-param name="x" select="$y"/></xsl:call-template>' +
          '</xsl:template>',
      ),
      '<r/>',
    );
    const { limit, observed } = e.details as { limit: string; observed: number };
    expect(limit).toBe('outputBytes');
    // Charged per node, as each is added: the overrun is one node, not one doubling.
    expect(observed).toBeLessThan(4 * MiB + 1024);
  });
});

describe('nested xdMath:Eval bombs (task 6)', () => {
  const MATH = 'http://schemas.microsoft.com/office/infopath/2003/xslt/Math';
  const functions = functionTable({
    now: '2026-11-03T09:00:00-08:00',
    locale: 'en-US',
    userName: '',
  });
  const evalSheet = (select: string) =>
    sheet(root(`<p><xsl:value-of select="${select}"/></p>`), ` xmlns:xdMath="${MATH}"`);

  test('an expression that evaluates itself: templateDepth, one level per Eval call', async () => {
    const self = 'xdMath:Eval(/r, string(/r/e))';
    const e = await explode('Eval recursion', evalSheet(self), `<r><e>${self}</e></r>`, {
      functions,
    });
    expect(e.details).toEqual({ limit: 'templateDepth', max: 128, observed: 129 });
  });

  test('Eval over 100 nodes, nested three deep: outputBytes, from the scratch nodes Eval returns', async () => {
    // XPath 1.0 strings cannot nest three quote levels; the inner expressions live in the record.
    const e1 = 'count(/r/a[xdMath:Eval(/r/a, string(/r/e2))])';
    const e2 = "count(/r/a[xdMath:Eval(/r/a, '1')])";
    const e = await explode(
      'Eval breadth',
      evalSheet('sum(xdMath:Eval(/r/a, string(/r/e1)))'),
      `<r>${'<a/>'.repeat(100)}<e1>${e1}</e1><e2>${e2}</e2></r>`,
      { functions },
    );
    // Each Eval result is a node-set of scratch elements, charged 64 bytes a node (design §6).
    expect(e.details).toMatchObject({ limit: 'outputBytes', max: 4 * MiB });
  });
});

describe('RangeError (design §5.3, Errors)', () => {
  test('a real stack overflow, with templateDepth raised past it, is LIMIT_EXCEEDED templateDepth', async () => {
    const e = await explode(
      'stack overflow',
      sheet(
        root('<xsl:call-template name="t"/>') +
          '<xsl:template name="t"><xsl:call-template name="t"/></xsl:template>',
      ),
      '<r/>',
      { limits: { templateDepth: 1_000_000 } },
    );
    expect(e.details).toMatchObject({ limit: 'templateDepth', max: 1_000_000 });
    expect((e.details as { observed: number }).observed).toBeGreaterThan(128);
  });

  test('any other RangeError gives RENDER_FAILED, never a crash', async () => {
    const functions: FunctionTable = new Map([
      [
        'urn:t',
        new Map([
          [
            'f',
            () => {
              throw new RangeError('Invalid string length');
            },
          ],
        ]),
      ],
    ]);
    const e = await explode(
      'RangeError',
      sheet(root('<p><xsl:value-of select="t:f()"/></p>'), ' xmlns:t="urn:t"'),
      '<r/>',
      { functions },
    );
    expect([e.code, e.details]).toEqual([
      'RENDER_FAILED',
      { view: 'View 1', xsltCode: 'RangeError', message: 'Invalid string length' },
    ]);
  });
});

describe('the sample views', () => {
  const NOW = '2026-11-03T09:00:00-08:00';
  let cases: ViewCase[];
  beforeAll(async () => {
    cases = await viewCases();
  });
  const prepare = async (slug: string) => {
    const c = cases.find((v) => v.slug === slug)!;
    return { c, p: await prepareView(c.t, buildFormIR(c.t), { view: c.view }) };
  };

  test('the 53 views, both records, render within the defaults', async () => {
    expect(cases).toHaveLength(53);
    for (const c of cases) {
      const p = await prepareView(c.t, buildFormIR(c.t), { view: c.view });
      for (const record of [c.records.empty, c.records.first]) {
        expect(() => renderView(p, { now: NOW, record }), c.id).not.toThrow();
      }
    }
  });

  test('RenderInput.limits overrides each default; no HTML comes back', async () => {
    const { c, p } = await prepare('06-safety-incident');
    const render = (limits: Partial<RenderLimits>) =>
      renderView(p, { now: NOW, record: c.records.first, limits });
    const at = (limits: Partial<RenderLimits>) => catchError(() => render(limits));
    // Form 06 nests 3 template calls and 1 built-in rule call.
    expect(render({ templateDepth: 4 }).html).toMatch(/^<div class="afl-root/);
    expect(at({ templateDepth: 3 }).details).toEqual({
      limit: 'templateDepth',
      max: 3,
      observed: 4,
    });
    expect(at({ evaluationSteps: 100 }).details).toMatchObject({
      limit: 'evaluationSteps',
      max: 100,
    });
    expect(at({ outputBytes: 1000 }).details).toMatchObject({
      limit: 'outputBytes',
      max: 1000,
    });
    expect(DEFAULT_RENDER_LIMITS).toEqual({
      templateDepth: 128,
      evaluationSteps: 200_000,
      outputBytes: 4 * MiB,
    });
  });
});
