import { describe, expect, test } from 'vitest';
import { buildTree, typeWords, walk } from '../src/side/tree';
import { irOf, OWN_08 } from './samples';

// R4.1: the tree holds every FormIR field and group exactly once, under its own group.
describe.each([...OWN_08, 'theill-weight-keeper'])('%s', (slug) => {
  test('every field and group once, each under its groupId, main first', async () => {
    const ir = await irOf(slug);
    const roots = buildTree(ir);
    expect(roots[0]?.dataSource).toBe('main');
    const seen: string[] = [];
    for (const r of roots)
      for (const n of walk(r.children)) {
        seen.push(n.id);
        for (const c of n.children) expect(c.node.groupId).toBe(n.id);
      }
    expect(seen.sort()).toEqual([...ir.fields, ...ir.groups].map((n) => n.id).sort());
  });
});

test('form 02: 12 fields, 4 groups, 1 repeating group; the expense row in schema order', async () => {
  const ir = await irOf('02-expense-report');
  const nodes = buildTree(ir).flatMap((r) => [...walk(r.children)]);
  expect(nodes.filter((n) => n.node.kind !== 'group')).toHaveLength(12);
  expect(nodes.filter((n) => n.node.kind === 'group')).toHaveLength(4);
  const repeating = nodes.filter((n) => n.node.kind === 'group' && n.node.repeating);
  expect(repeating.map((n) => n.node.name)).toEqual(['expense']);
  expect(repeating[0]!.children.map((c) => c.node.name)).toEqual([
    'expenseDate',
    'expenseType',
    'expenseDescription',
    'amount',
    'receipt',
  ]);
  expect(repeating[0]!.children.map((c) => typeWords(c.node))).toEqual([
    'Date',
    'Text',
    'Text',
    'Decimal',
    'Picture or file attachment',
  ]);
});

test('form 08: 200 fields', async () => {
  const ir = await irOf('08-big-form');
  const fields = buildTree(ir)
    .flatMap((r) => [...walk(r.children)])
    .filter((n) => n.node.kind !== 'group');
  expect(fields).toHaveLength(200);
});

test('form 04: main, then the secondary data sources by name', async () => {
  expect(buildTree(await irOf('04-purchase-request')).map((r) => r.dataSource)).toEqual([
    'main',
    'BudgetService',
    'Vendors',
  ]);
});
