import { expect, test } from 'vitest';
import { connectionsOf } from '../src/side/connections';
import { irOf } from './samples';

// R6.1 on forms 01–08.
const short = (id: string | undefined) => id?.replace(/^f:[^:]*:/, '');

test('form 03: one XML file connection, locations.xml, that works offline', async () => {
  const [c, ...rest] = connectionsOf(await irOf('03-travel-request'));
  expect(rest).toEqual([]);
  expect(c).toMatchObject({
    name: 'Locations',
    kind: 'XML file',
    direction: 'Query',
    targets: [{ attribute: 'fileUrl', value: 'locations.xml' }],
    status: 'Works offline',
    reasons: [],
  });
  // It fills the Locations tree, and the country and city drop-downs of both views use it.
  expect(c!.fills.map((u) => u.label)).toHaveLength(3);
  const controls = c!.usedBy.filter((u) => u.kind === 'Control');
  expect(controls).toHaveLength(4);
  expect(new Set(controls.map((u) => short(u.fieldId)))).toEqual(
    new Set(['/my:travelRequest/my:destCountry', '/my:travelRequest/my:destCity']),
  );
});

test('form 04: SQL on sql-legacy01 and a web service on forms-legacy, both dead, internal host', async () => {
  const cs = connectionsOf(await irOf('04-purchase-request'));
  expect(cs.map((c) => [c.name, c.kind, c.direction, c.status, c.reasons])).toEqual([
    [
      'Vendors',
      'Database (SQL)',
      'Query',
      'Dead after migration',
      ['internal server sql-legacy01'],
    ],
    [
      'BudgetService',
      'Web service',
      'Query',
      'Dead after migration',
      ['internal server forms-legacy'],
    ],
  ]);
  const [sql, ws] = cs as [(typeof cs)[0], (typeof cs)[0]];
  expect(sql.targets.map((t) => t.attribute)).toEqual(['connectionString']);
  expect(sql.targets[0]!.value).toContain('Data Source=sql-legacy01');
  expect(sql.usedBy.map((u) => [u.kind, short(u.fieldId)])).toEqual([
    ['Control', '/my:purchaseRequest/my:vendorId'],
  ]);
  expect(ws.targets.map((t) => t.value)).toEqual([
    'http://forms-legacy/budget/BudgetService.asmx?WSDL',
    'http://forms-legacy/budget/BudgetService.asmx',
  ]);
  // Both rule assignments read BudgetService; each is selectable through the field it sets.
  const actions = ws.usedBy.filter((u) => u.kind === 'Rule action');
  expect(actions).toHaveLength(2);
  for (const a of actions) expect(a.fieldId).toBeDefined();
  expect(ws.fills.map((u) => u.kind)).toEqual(['Field', 'Field']);
});

test('forms 01, 02, 07: one email submit, dead', async () => {
  for (const slug of ['01-leave-request', '02-expense-report', '07-leave-request-v2']) {
    const cs = connectionsOf(await irOf(slug));
    expect(
      cs.map((c) => [c.name, c.kind, c.direction, c.status, c.reasons]),
      slug,
    ).toEqual([
      [
        'Main submit',
        'Email submit',
        'Submit',
        'Dead after migration',
        ['sends email from InfoPath'],
      ],
    ]);
    expect(
      cs[0]!.targets.map((t) => t.attribute),
      slug,
    ).toEqual(['to']);
    // The field its "to" reads is listed and selectable.
    expect(
      cs[0]!.usedBy.map((u) => u.kind),
      slug,
    ).toEqual(['Field']);
  }
});

test('forms 05, 06, 08: no data connections', async () => {
  for (const slug of ['05-new-hire-onboarding', '06-safety-incident', '08-big-form'])
    expect(connectionsOf(await irOf(slug)), slug).toEqual([]);
});

test('every use of every connection selects a field in the tree', async () => {
  for (const slug of ['01-leave-request', '03-travel-request', '04-purchase-request']) {
    const ir = await irOf(slug);
    const ids = new Set([...ir.fields, ...ir.groups].map((n) => n.id));
    for (const c of connectionsOf(ir))
      for (const u of [...c.fills, ...c.usedBy]) expect(ids.has(u.fieldId!), u.id).toBe(true);
  }
});
