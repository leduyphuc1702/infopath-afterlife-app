import fc from 'fast-check';
import { expect, test } from 'vitest';
import { matchRecord, type RecordMatch, type TemplateKey } from '../../src/index';

// Property P14 (spec 09 R11.1): matchRecord never throws; the matched template's key does not
// depend on the order of the list; and the match is exact exactly when a key has the record's URN
// and a version equal to the record's, a version missing on either side counting as equal.

const RUNS = 1_000;
const URNS = ['urn:a', 'urn:b', 'urn:c'];
const VERSIONS = ['1.0.0.1', '1.0.0.2', '2.0'];
const opt = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined });

const pi = fc
  .record({
    urn: opt(fc.constantFrom(...URNS)),
    version: opt(fc.constantFrom(...VERSIONS)),
    quote: fc.constantFrom('"', "'"),
  })
  .map(({ urn, version, quote: q }) => {
    const attrs = [
      urn !== undefined && `name=${q}${urn}${q}`,
      version !== undefined && `solutionVersion=${q}${version}${q}`,
    ].filter(Boolean);
    return { urn, version, text: `<?mso-infoPathSolution ${attrs.join(' ')} ?>` };
  });

interface Doc {
  bytes: Uint8Array;
  xml?: true;
  /** What the first 4 KB say: the first instruction there, if any. */
  urn?: string;
  version?: string;
}

const xmlDoc: fc.Arbitrary<Doc> = fc
  .record({ pis: fc.array(pi, { maxLength: 2 }), late: fc.boolean() })
  .map(({ pis, late }) => {
    const pad = late ? `<!--${'x'.repeat(4200)}-->` : '';
    const text = `<?xml version="1.0"?>${pad}${pis.map((p) => p.text).join('')}<my:r/>`;
    const seen = late ? undefined : pis[0];
    return {
      bytes: new TextEncoder().encode(text),
      xml: true as const,
      ...(seen?.urn !== undefined && { urn: seen.urn }),
      ...(seen?.version !== undefined && { version: seen.version }),
    };
  });

const doc: fc.Arbitrary<Doc> = fc.oneof(
  { weight: 4, arbitrary: xmlDoc },
  { weight: 1, arbitrary: fc.uint8Array({ maxLength: 512 }).map((bytes): Doc => ({ bytes })) },
);
const keys = fc.array(
  fc.record({ urn: opt(fc.constantFrom(...URNS)), version: opt(fc.constantFrom(...VERSIONS)) }),
  { maxLength: 5 },
);

const clean = (k: { urn?: string | undefined; version?: string | undefined }): TemplateKey => ({
  ...(k.urn !== undefined && { urn: k.urn }),
  ...(k.version !== undefined && { version: k.version }),
});
const keyOf = (m: RecordMatch, list: readonly TemplateKey[]) =>
  m.kind === 'unmatched' ? m : { kind: m.kind, key: list[m.template] };

test(`${RUNS} generated records and template lists`, () => {
  fc.assert(
    fc.property(doc, keys, fc.nat(), (d, raw, seed) => {
      const list = raw.map(clean);
      const m = matchRecord(d.bytes, list);
      // Any order of the list gives the same key.
      const shuffled = [...list.entries()]
        .sort(([a], [b]) => ((a * 7919 + seed) % 13) - ((b * 7919 + seed) % 13) || a - b)
        .map(([, k]) => k);
      expect(keyOf(matchRecord(d.bytes, shuffled), shuffled)).toEqual(keyOf(m, list));
      expect(keyOf(matchRecord(d.bytes, [...list].reverse()), [...list].reverse())).toEqual(
        keyOf(m, list),
      );
      // Exact exactly when a key has the record's URN and an equal or missing version.
      if (d.xml && d.urn === undefined)
        expect(m).toEqual({ kind: 'unmatched', reason: 'noSolution' });
      if (d.urn !== undefined) {
        const exact = list.some(
          (k) =>
            k.urn === d.urn &&
            (k.version === d.version || k.version === undefined || d.version === undefined),
        );
        expect(m.kind === 'exact').toBe(exact);
      }
    }),
    { numRuns: RUNS },
  );
});
