import { expect, test } from 'vitest';
import { fill, recordNames, slugs } from './fill';

// Spec 04 R11.4: every record of ours is valid after opening (R1.2: onLoad and recalculation
// run first), unless verification.md lists it with its reason.

test('validation oracle: our records after opening', async () => {
  let records = 0;
  const invalid: string[] = [];
  for (const slug of slugs())
    for (const name of recordNames(slug)) {
      records++;
      const { s } = await fill(slug, name);
      for (const i of s.invalid()) invalid.push(`${name} ${i.path}: ${i.kind} "${i.short}"`);
    }
  const bad = new Set(invalid.map((i) => i.split(' ')[0]));
  console.log(`R11.4: ${records - bad.size} of ${records} records valid`);
  for (const i of invalid) console.log(`  invalid: ${i}`);
  expect(records).toBe(348);
  // Every invalid field is the sample generator's data breaking the form's own errorCondition
  // (verification.md lists each): hours over 24, scores out of range, a return before the loan.
  const groups = new Map<string, number>();
  for (const i of invalid) {
    const k = `${i.slice(0, 2)} ${i.slice(i.indexOf('"'))}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  expect(Object.fromEntries(groups)).toEqual(KNOWN);
  expect(invalid.every((i) => i.includes(': errorCondition '))).toBe(true);
}, 120_000);

const KNOWN = {
  '10 "Max 24"': 7,
  '16 "Before start"': 2,
  '17 "Lower than start"': 3,
  '24 "1 to 5"': 8,
  '40 "1 to 10"': 4,
};
