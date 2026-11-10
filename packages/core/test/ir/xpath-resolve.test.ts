import { describe, expect, test } from 'vitest';
import { buildFormIR, type FormIR } from '../../src/index';
import { buildDataTree, NameIndex } from '../../src/ir/data-tree';
import { IdRegistry } from '../../src/ir/ids';
import {
  contextFor,
  elementScope,
  manifestScope,
  resolveExpression,
  type Ctx,
  type ResolveEnv,
} from '../../src/ir/xpath/resolve';
import { DEFAULT_LIMITS } from '../../src/limits';
import { parseXml, xmlContext } from '../../src/xml/parse';
import { sampleTemplates } from '../helpers/formir';

// Spec 02 R11.2, R11.4, design §7.2–§7.3.

const samples = await sampleTemplates();
const sample = (n: number) => {
  const s = samples.find((x) => x.form === n)!;
  const tree = buildDataTree(s.t, new IdRegistry());
  return { t: s.t, env: tree as ResolveEnv, scope: manifestScope(s.t.manifest.namespaces) };
};
const DOC: Ctx = { ds: 'main', node: null };

/** A synthetic tree: main /my:r/my:rows/my:row/my:amount, and Src /z:row/@ows_Title. */
function synthetic(): ResolveEnv {
  const index = new NameIndex();
  const parentOf = new Map<string, string>();
  const add = (
    ds: string,
    parent: string | null,
    ns: string | null,
    name: string,
    id: string,
    attr = false,
  ) => {
    index.add(ds, parent, { nodeType: attr ? 'attribute' : 'element', namespace: ns, name }, id);
    if (parent) parentOf.set(id, parent);
  };
  add('main', null, 'urn:my', 'r', 'g:r');
  add('main', 'g:r', 'urn:my', 'rows', 'g:rows');
  add('main', 'g:rows', 'urn:my', 'row', 'g:row');
  add('main', 'g:row', 'urn:my', 'amount', 'f:amount');
  add('main', 'g:r', null, 'note', 'f:note');
  add('Src', null, 'urn:z', 'row', 'g:zrow');
  add('Src', 'g:zrow', null, 'ows_Title', 'f:title', true);
  return { index, parentOf };
}
const scope = manifestScope({ my: 'urn:my', z: 'urn:z' });

describe('contexts (R11.2)', () => {
  test("form 03: '../my:destCity' from destCountry", () => {
    const { env, scope: sc } = sample(3);
    const at = contextFor('/my:travelRequest/my:destCountry', undefined, sc, env);
    expect(at).toEqual({ ds: 'main', node: 'f:main:/my:travelRequest/my:destCountry' });
    const r = resolveExpression('../my:destCity', at as Ctx, sc, env);
    expect(r.whole).toBe('f:main:/my:travelRequest/my:destCity');
  });

  test('form 04: GetDOM("BudgetService") switches to that tree', () => {
    const { env, scope: sc } = sample(4);
    const r = resolveExpression(
      'xdXDocument:GetDOM("BudgetService")/dfs:myFields/dfs:queryFields/tns:GetRemainingBudget/tns:costCenter',
      DOC,
      sc,
      env,
    );
    expect(r.unresolved).toEqual([]);
    expect(r.whole).toMatch(/^f:BudgetService:\/dfs:myFields\/dfs:queryFields\//);
  });

  test('a validation context: match, then expressionContext', () => {
    const env = synthetic();
    expect(contextFor('/my:r/my:rows', 'my:row', scope, env)).toEqual({
      ds: 'main',
      node: 'g:row',
    });
    expect(contextFor('/my:r', '.', scope, env)).toEqual({ ds: 'main', node: 'g:r' });
  });

  test('current() is the expression context, inside a GetDOM predicate', () => {
    const { env, scope: sc } = sample(3);
    const r = resolveExpression(
      'xdXDocument:GetDOM("Locations")/locations/country[@code = current()/my:destCountry]/city',
      { ds: 'main', node: 'g:main:/my:travelRequest' },
      sc,
      env,
    );
    expect(r.refs.map((x) => x.targetId)).toEqual([
      'f:Locations:/locations/country/city',
      'f:Locations:/locations/country/@code',
      'f:main:/my:travelRequest/my:destCountry',
    ]);
  });
});

describe('private-corpus binding shapes', () => {
  test('GetDOM("Src")/z:row/@ows_Title with z from the XSL element scope', () => {
    const xsl = parseXml(
      new TextEncoder().encode(
        '<x:stylesheet xmlns:x="urn:x" xmlns:z="urn:z"><span/></x:stylesheet>',
      ),
      'view1.xsl',
      xmlContext(DEFAULT_LIMITS),
    ).root;
    const span = xsl.children[0]!;
    if (span.kind !== 'element') throw new Error('expected an element');
    const r = resolveExpression(
      'xdXDocument:GetDOM("Src")/z:row/@ows_Title',
      DOC,
      elementScope(span),
      synthetic(),
    );
    expect(r.whole).toBe('f:title');
    const noZ = resolveExpression(
      'xdXDocument:GetDOM("Src")/z:row/@ows_Title',
      DOC,
      manifestScope({}),
      synthetic(),
    );
    expect(noZ.unresolved.map((u) => u.reason)).toEqual(['unknownPrefix']);
  });

  test('ExpressionBox shapes: a function over a repeating path, and a literal with no path', () => {
    const env = synthetic();
    const avg = resolveExpression(
      'xdMath:Avg(my:rows/my:row/my:amount)',
      { ds: 'main', node: 'g:r' },
      scope,
      env,
    );
    expect(avg.refs.map((x) => x.targetId)).toEqual(['f:amount']);
    expect(avg.whole).toBeUndefined();
    expect(resolveExpression('string("Totals")', DOC, scope, env)).toEqual({
      refs: [],
      unresolved: [],
    });
  });
});

describe('one case per unresolved reason (R11.4)', () => {
  const env = synthetic();
  const at: Ctx = { ds: 'main', node: 'g:r' };
  test.each([
    ['$v/my:rows', 'variable'],
    ['//my:amount', 'descendant'],
    ['my:rows/*', 'wildcard'],
    ['my:rows/my:*', 'wildcard'],
    ['my:rows/node()', 'wildcard'],
    ['ancestor::my:r', 'axis'],
    ['xdXDocument:GetDOM($s)/z:row', 'dynamicGetDom'],
    ['xdXDocument:GetDOM("Nope")/z:row', 'unknownDataSource'],
    ['../..', 'aboveRoot'],
    ['q:rows', 'unknownPrefix'],
    ['my:nope', 'notInTree'],
    ['rows', 'notInTree'],
    ['xdMath:Eval(my:rows, "my:x")', 'stringExpression'],
    ['(my:rows)/my:row', 'notInTree'],
    ['"unterminated', 'notInTree'],
  ])('%s → %s', (text, reason) => {
    const r = resolveExpression(text, at, scope, env);
    expect(r.unresolved.map((u) => u.reason)).toContain(reason);
  });

  test('a predicate under a failed step fails with the step reason', () => {
    const r = resolveExpression('my:nope[my:amount > 1]', at, scope, env);
    expect(r.unresolved.map((u) => [u.text, u.reason])).toEqual([
      ['my:nope[my:amount > 1]', 'notInTree'],
      ['my:amount', 'notInTree'],
    ]);
  });

  test('unprefixed names are in no namespace; text() is the same field', () => {
    expect(resolveExpression('my:note', at, scope, env).unresolved).toHaveLength(1);
    expect(resolveExpression('note', at, scope, env).whole).toBe('f:note');
    expect(resolveExpression('note/text()', at, scope, env).whole).toBe('f:note');
  });
});

test('every manifest calculation of the samples resolves (smoke for stage 7)', () => {
  for (const s of samples) {
    const ir: FormIR = buildFormIR(s.t);
    const tree = buildDataTree(s.t, new IdRegistry());
    const sc = manifestScope(s.t.manifest.namespaces);
    for (const c of ir.calculations) {
      const at = contextFor(c.target, undefined, sc, tree);
      expect('node' in at, `${s.slug} ${c.target}`).toBe(true);
      const r = resolveExpression(c.expression, at as Ctx, sc, tree);
      expect(r.unresolved, `${s.slug} ${c.expression}`).toEqual([]);
    }
  }
});
