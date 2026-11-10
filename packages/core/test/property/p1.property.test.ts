import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { AfterlifeError, parseXsn } from '../../src/index';
import { ERROR_CODES, type ErrorCode } from '../../src/errors';
import {
  bytesInput,
  cabinetInput,
  materialize,
  xmlInput,
  type Generator,
  type P1Input,
} from './p1-inputs';
import { P1_REGRESSIONS } from './regressions';

// Property P1 (design §13.3, R19): for random bytes, mutated sample cabinets, and valid cabinets
// whose manifest or schema text is mutated, parseXsn resolves, or rejects with an AfterlifeError
// whose code is in design §11, within 1 s. INTERNAL is in §11 but means a parser bug, so it fails
// here too. Each run is timed with performance.now() around parseXsn only.

const RUNS = 1_000;
const BOUND_MS = 1_000;

type Outcome = 'result' | ErrorCode;

interface Run {
  ms: number;
  outcome: Outcome;
}

/** Throws (failing the run) on anything other than a typed, non-internal outcome. */
async function check(p: P1Input): Promise<Run> {
  const bytes = materialize(p);
  const t0 = performance.now();
  let outcome: Outcome;
  try {
    await parseXsn(bytes);
    outcome = 'result';
  } catch (e) {
    if (!(e instanceof AfterlifeError)) {
      throw new Error(
        `untyped error: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`,
        { cause: e },
      );
    }
    const code = (e as AfterlifeError<ErrorCode>).code;
    if (!ERROR_CODES.includes(code))
      throw new Error(`AfterlifeError with unknown code ${code}`, { cause: e });
    if (code === 'INTERNAL') throw new Error(`INTERNAL: ${e.message}`, { cause: e });
    outcome = code;
  }
  const ms = performance.now() - t0;
  if (ms >= BOUND_MS) throw new Error(`run took ${ms.toFixed(0)} ms (bound ${BOUND_MS} ms)`);
  return { ms, outcome };
}

const arbitraries: Record<Generator, fc.Arbitrary<P1Input>> = {
  bytes: bytesInput.map((input) => ({ generator: 'bytes', input })),
  cabinet: cabinetInput.map((input) => ({ generator: 'cabinet', input })),
  xml: xmlInput.map((input) => ({ generator: 'xml', input })),
};

describe.each(Object.keys(arbitraries) as Generator[])('generator %s', (generator) => {
  test(`${RUNS} runs: a result or a typed error, each under ${BOUND_MS} ms`, async () => {
    const runs: Run[] = [];
    const t0 = performance.now();
    await fc.assert(
      fc.asyncProperty(arbitraries[generator], async (p) => {
        runs.push(await check(p));
      }),
      { numRuns: RUNS },
    );
    const slowest = Math.max(...runs.map((r) => r.ms));
    const outcomes: Record<string, number> = {};
    for (const r of runs) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    console.log(
      `P1 ${generator}: ${runs.length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s, ` +
        `slowest parseXsn ${slowest.toFixed(1)} ms; outcomes ${JSON.stringify(outcomes)}`,
    );
    expect(runs).toHaveLength(RUNS);
  }, 300_000);
});

test.each(P1_REGRESSIONS.map((r) => [r.note, r.case] as const))(
  'regression: %s',
  async (_note, p) => {
    await expect(check(p)).resolves.toBeDefined();
  },
);

test('regressions are replayed', () => {
  // Visible in the log even while the list is empty.
  expect(Array.isArray(P1_REGRESSIONS)).toBe(true);
});
