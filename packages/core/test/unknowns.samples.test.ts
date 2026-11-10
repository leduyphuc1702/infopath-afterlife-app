import { expect, test } from 'vitest';
import { parseXsn } from '../src/index';
import { readSample, sampleCabinets } from './helpers/samples';

// R13.6, R15.6: every README form and the public sample parse with zero unknown entries, in the
// manifest and in every schema. A new entry is fixed by modelling the node or correcting the
// sample, never by an allow-list.

const cabinets = sampleCabinets();

test('there are 48 cabinets', () => {
  expect(cabinets).toHaveLength(48);
});

test.each(cabinets.map((c) => [c.slug, c.path]))('%s: no unknown entries', async (_slug, path) => {
  const t = await parseXsn(readSample(path));
  expect(t.unknowns).toEqual([]);
  // The manifest and at least one schema were read, so "empty" covers both (R13.6, R15.6).
  expect(t.schemas.main).toBeDefined();
});
