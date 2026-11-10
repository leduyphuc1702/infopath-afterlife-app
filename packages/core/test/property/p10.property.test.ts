import { readdirSync, readFileSync } from 'node:fs';
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { triageFiles } from '../../src/index';
import { readSample, repoRoot } from '../helpers/samples';

// Property P10 (spec 12 R3.6): the same templates and records in any order give the same rows,
// in the same order, byte-equal as JSON. Forms 01–08 and their 153 records, shuffled; a random
// subset of the records each run, so record counts vary too.
const RUNS = 100;
const OWN = `${repoRoot}samples/own/`;
const slugs = readdirSync(`${OWN}xsn/`)
  .filter((f) => /^0[1-8]-.*\.xsn$/.test(f))
  .map((f) => f.slice(0, -4));
const templates = slugs.map((s) => ({ name: `${s}.xsn`, bytes: readSample(`${OWN}xsn/${s}.xsn`) }));
const records = slugs.flatMap((s) =>
  readdirSync(`${OWN}records/${s}/`)
    .filter((f) => !f.endsWith('-000-empty.xml'))
    .map((f) => ({ name: f, bytes: new Uint8Array(readFileSync(`${OWN}records/${s}/${f}`)) })),
);

test(`${RUNS} runs: input order never changes the result`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.subarray(records), fc.nat(), async (subset, seed) => {
      const files = [...templates, ...subset];
      const sorted = JSON.stringify(await triageFiles(files));
      const shuffled = fc.sample(fc.shuffledSubarray(files, { minLength: files.length }), {
        seed,
        numRuns: 1,
      })[0]!;
      expect(JSON.stringify(await triageFiles(shuffled))).toBe(sorted);
    }),
    { numRuns: RUNS },
  );
}, 120_000);
