// The samples/own/README.md table as an oracle (design §13.1): the first Markdown table whose header
// has a `Folder` column; columns are found by header name, so reordering them is harmless; the
// slug is the text in backticks in `Folder`; every count cell must be a plain integer.
// Written for task 13 (Checks per form); tested in oracles/readme-table.test.ts (task 22).

import { readFileSync } from 'node:fs';
import { repoRoot } from '../helpers/samples';

export const COUNT_COLUMNS = [
  'Views',
  'Fields',
  'Rules',
  'Calcs',
  'Checks',
  'Repeating/optional',
] as const;
export type CountColumn = (typeof COUNT_COLUMNS)[number];

export interface ReadmeRow {
  readonly slug: string;
  readonly counts: Readonly<Record<CountColumn, number>>;
}

export function readmeTable(
  text = readFileSync(`${repoRoot}samples/own/README.md`, 'utf8'),
): ReadmeRow[] {
  const lines = text.split(/\r?\n/);
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
  const start = lines.findIndex((l) => l.trim().startsWith('|') && cells(l).includes('Folder'));
  if (start < 0) throw new Error('README: no table with a Folder column');
  const header = cells(lines[start]!);
  const index = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`README: no ${name} column`);
    return i;
  };
  const folder = index('Folder');
  const columns = COUNT_COLUMNS.map((c) => [c, index(c)] as const);

  const rows: ReadmeRow[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith('|')) break;
    const row = cells(line);
    const slug = /^`([^`]+)`$/.exec(row[folder] ?? '')?.[1];
    if (!slug) throw new Error(`README: no slug in ${line}`);
    if (seen.has(slug)) throw new Error(`README: duplicate slug ${slug}`);
    seen.add(slug);
    const counts = {} as Record<CountColumn, number>;
    for (const [name, i] of columns) {
      const cell = row[i] ?? '';
      if (!/^\d+$/.test(cell))
        throw new Error(`README: ${slug} ${name} is not an integer: ${cell}`);
      counts[name] = Number(cell);
    }
    rows.push({ slug, counts });
  }
  return rows;
}
