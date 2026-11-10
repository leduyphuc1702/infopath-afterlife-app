import { readdirSync, readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { parseFormIR, serialiseFormIR, type FormIR } from '../../src/index';
import { formIR } from './p6-inputs';
import { P6_REGRESSIONS } from './regressions';

// Property P6 (spec 02 R14): parseFormIR(serialiseFormIR(ir)) deep-equals ir, and
// serialiseFormIR(parseFormIR(s)) === s, for generated FormIRs and the 48 golden files.

const RUNS = 500;

const roundTrip = (ir: FormIR) => {
  const s = serialiseFormIR(ir);
  const back = parseFormIR(s);
  expect(back).toEqual(ir);
  expect(serialiseFormIR(back)).toBe(s);
};

test(`${RUNS} generated FormIRs round-trip`, () => {
  fc.assert(
    fc.property(formIR, (ir) => {
      roundTrip(ir);
    }),
    { numRuns: RUNS },
  );
});

test('__proto__ in attrs is data, not a prototype', () => {
  const [ir] = fc.sample(formIR, { seed: 6, numRuns: 1 });
  const attrs = Object.fromEntries([['__proto__', 'x']]) as Record<string, string>;
  const withProto: FormIR = {
    ...ir!,
    signatures: {
      ...ir!.signatures,
      signatureLines: [{ id: 's', attrs, source: ir!.meta.source }],
    },
  };
  const back = parseFormIR(serialiseFormIR(withProto));
  const got = back.signatures.signatureLines[0]!.attrs;
  expect(Object.keys(got)).toEqual(['__proto__']);
  expect(Object.getOwnPropertyDescriptor(got, '__proto__')?.value).toBe('x');
});

describe('the 48 golden FormIRs', () => {
  const dir = new URL('../golden/formir/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  test('48 files', () => {
    expect(files).toHaveLength(48);
  });

  test.each(files)('%s', (f) => {
    const s = readFileSync(new URL(f, dir), 'utf8');
    expect(serialiseFormIR(parseFormIR(s))).toBe(s);
    roundTrip(parseFormIR(s));
  });
});

test.each(P6_REGRESSIONS.map((r) => [r.note, r.case] as const))('regression: %s', (_n, ir) => {
  roundTrip(ir);
});
