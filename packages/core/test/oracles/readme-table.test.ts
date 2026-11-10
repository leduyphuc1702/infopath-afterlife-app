import { expect, test } from 'vitest';
import { readmeTable } from './readme-table';

// Design §13.1, R16.3: the README oracle parses by header name and fails loudly.

const HEADER =
  '| # | Folder | Views | Fields | Records | Rules | Calcs | Checks | Repeating/optional |';
const table = (header: string, ...rows: string[]) =>
  `# Samples\n\nIntro | not a table\n\n${header}\n|${'---|'.repeat(header.split('|').length - 2)}\n${rows.join('\n')}\n\n## Layout\n`;

test('the real README parses: 47 rows', () => {
  const rows = readmeTable();
  expect(rows).toHaveLength(47);
  expect(rows[4]).toEqual({
    slug: '05-new-hire-onboarding',
    counts: { Views: 3, Fields: 25, Rules: 3, Calcs: 0, Checks: 2, 'Repeating/optional': 1 },
  });
});

test('reordered columns still parse', () => {
  const rows = readmeTable(
    table(
      '| Repeating/optional | Checks | Folder | Calcs | Rules | Fields | Views |',
      '| 4 | 0 | `x-form` | 1 | 2 | 5 | 1 |',
    ),
  );
  expect(rows).toEqual([
    {
      slug: 'x-form',
      counts: { Views: 1, Fields: 5, Rules: 2, Calcs: 1, Checks: 0, 'Repeating/optional': 4 },
    },
  ]);
});

test('a missing column fails', () => {
  expect(() =>
    readmeTable(
      table('| Folder | Views | Fields | Rules | Calcs | Checks |', '| `a` | 1 | 1 | 0 | 0 | 0 |'),
    ),
  ).toThrow(/no Repeating\/optional column/);
});

test.each(['1.5', '', 'one', '-1', '2x'])('a non-integer cell (%j) fails', (cell) => {
  expect(() =>
    readmeTable(table(HEADER, `| 1 | \`a\` | ${cell} | 1 | 1 | 0 | 0 | 0 | 0 |`)),
  ).toThrow(/is not an integer/);
});

test('a duplicate slug fails', () => {
  const row = '| 1 | `a` | 1 | 1 | 1 | 0 | 0 | 0 | 0 |';
  expect(() => readmeTable(table(HEADER, row, row))).toThrow(/duplicate slug a/);
});

test('a row with no slug in backticks fails', () => {
  expect(() => readmeTable(table(HEADER, '| 1 | a | 1 | 1 | 1 | 0 | 0 | 0 | 0 |'))).toThrow(
    /no slug/,
  );
});

test('no table with a Folder column fails', () => {
  expect(() => readmeTable('# Nothing here\n')).toThrow(/no table with a Folder column/);
});
