import { readdirSync, readFileSync } from 'node:fs';
import { CAUSE_IDS, CAUSES, CSV_COLUMNS, WAVE_RULES } from '@afterlife/core';
import { expect, test } from 'vitest';

// Spec 12 R3.7: no time, effort, cost or man-hour estimate anywhere in what Triage shows: the
// Triage screens, the certificate, the print view, the CSV header and core's cause and wave text.
const ESTIMATE =
  /\b(effort|estimat\w*|man[- ]?hours?|person[- ]?days?|hours?|weeks?|months?|costs?|budget(?:ed)?|duration|ETA|sprints?|story points?)\b/i;
const TRIAGE = new URL('../src/triage/', import.meta.url);

/** The text a user can read in a TSX file: JSX text and string literals, not identifiers. */
const visible = (tsx: string) =>
  [
    ...tsx.matchAll(/>([^<>{}]+)</g),
    ...tsx.matchAll(/'([^'\n]*)'/g),
    ...tsx.matchAll(/`([^`]*)`/g),
  ].map((m) => m[1]!);

test('no estimate words in the Triage, certificate and print strings', () => {
  const found: string[] = [];
  for (const f of readdirSync(TRIAGE).filter((x) => /\.tsx?$/.test(x)))
    for (const t of visible(readFileSync(new URL(f, TRIAGE), 'utf8')))
      if (ESTIMATE.test(t)) found.push(`${f}: ${t}`);
  for (const id of CAUSE_IDS)
    for (const t of [CAUSES[id].dateWords, CAUSES[id].replacement, CAUSES[id].source?.title ?? ''])
      if (ESTIMATE.test(t)) found.push(`${id}: ${t}`);
  for (const t of [...CSV_COLUMNS, ...Object.values(WAVE_RULES)])
    if (ESTIMATE.test(t)) found.push(`core: ${t}`);
  expect(found).toEqual([]);
});

test('the oracle finds estimate words', () => {
  for (const t of ['about 3 hours', 'Effort: low', 'man-hours', 'estimated', 'Cost'])
    expect(ESTIMATE.test(t), t).toBe(true);
  expect(ESTIMATE.test('July 14, 2026 (last day of extended support)')).toBe(false);
});
