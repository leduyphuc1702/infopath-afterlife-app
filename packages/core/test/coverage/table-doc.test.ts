import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CLASS_WORDS, COVERAGE_TABLE } from '../../src/index';
import { repoRoot } from '../helpers/samples';

// Spec 12 R1.3: each entry cites a row of docs/feature-coverage.md that exists in the cited
// section, and the row's Coverage cell names the entry's class in the doc's words, unless the
// entry carries a `verify` note.
const doc = readFileSync(`${repoRoot}docs/feature-coverage.md`, 'utf8');

/** Section letter → its table rows, as cells. */
function sections(): Map<string, string[][]> {
  const out = new Map<string, string[][]>();
  let current = '';
  let coverageCol = -1;
  for (const line of doc.split('\n')) {
    const h = /^## ([A-K])\. /.exec(line);
    if (h) {
      current = h[1]!;
      out.set(current, []);
      coverageCol = -1;
      continue;
    }
    if (!line.startsWith('|') || !current) continue;
    const cells = line
      .slice(1, -1)
      .split(' | ')
      .map((c) => c.trim().replace(/^\| ?| ?\|$/g, ''));
    if (cells.every((c) => /^-+$/.test(c))) continue;
    if (coverageCol < 0) {
      coverageCol = cells.indexOf('Coverage');
      continue;
    }
    out.get(current)!.push([cells[0]!, cells[coverageCol] ?? '']);
  }
  return out;
}

test('every cited row exists, and its Coverage cell names the class', () => {
  const s = sections();
  const problems: string[] = [];
  for (const e of COVERAGE_TABLE) {
    const row = s.get(e.cites.section)?.find(([first]) => first === e.cites.row);
    if (!row) {
      problems.push(
        `${e.kind}:${e.subtype}: no row "${e.cites.row}" in section ${e.cites.section}`,
      );
      continue;
    }
    const word = CLASS_WORDS[e.class].doc;
    if (!row[1]!.includes(word) && e.verify === undefined)
      problems.push(`${e.kind}:${e.subtype}: "${row[1]}" does not say ${word}`);
  }
  expect(problems).toEqual([]);
});

test('kind and subtype are unique', () => {
  // Controls match without case, so their subtypes must be unique without case too.
  const keys = COVERAGE_TABLE.map(
    (e) => `${e.kind}|${e.kind === 'control' ? e.subtype.toLowerCase() : e.subtype}`,
  );
  expect(new Set(keys).size).toBe(keys.length);
});

test('the doc and the UI map App to Emulated', () => {
  expect(CLASS_WORDS.emulated).toEqual({ ui: 'Emulated', doc: 'App' });
});
