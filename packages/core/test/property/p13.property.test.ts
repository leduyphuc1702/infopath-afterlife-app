import fc from 'fast-check';
import { expect, test } from 'vitest';
import { buildFormIR, type FormIR } from '../../src/index';
import type { Manifest } from '../../src/xsf/types';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { sampleTemplates } from '../helpers/formir';
import { build, p13Input, relative, type P13Input } from './p13-inputs';
import { P13_REGRESSIONS } from './regressions';

// Property P13 (spec 02 R12): a calculated field added to a sample, whose expression holds 1–4
// field references (absolute, relative with `..`, in a predicate, after GetDOM for a secondary
// tree) among operators, function calls, numbers and string literals with path-like text. Every
// inserted field lists the calculation in its readBy; a field only inside a literal does not.

const RUNS = 500;
const PATH = '/xsf:xDocumentClass[1]/xsf:calculations[1]/xsf:calculatedField[9999]';
const ID = 'calc:/xsf:calculations[1]/xsf:calculatedField[9999]';

const samples = (await sampleTemplates()).map((s) => ({ ...s, ir: buildFormIR(s.t) }));
const withSecondary = samples.filter((s) => s.ir.fields.some((f) => f.dataSource !== 'main'));

/** How often each shape occurred, so the property cannot pass vacuously. */
const seen = { getDom: 0, up: 0, predicate: 0, literal: 0 };

function check(input: P13Input): void {
  // A GetDOM reference needs a secondary tree: only forms 03 and 04 have one.
  const pool = input.refs.some((r) => r.form === 'getDom') ? withSecondary : samples;
  const s = pool[input.sample % pool.length]!;
  const b = build(input, s.ir.fields);
  const calc: Manifest['calculations'][number] = {
    key: 'xsf:calculatedField',
    attrs: { target: b.target.path, expression: b.expression, refresh: 'onChange' },
    file: s.t.manifestFile,
    path: PATH,
    line: 1,
    column: 1,
  };
  const t: ParsedTemplate = {
    ...s.t,
    manifest: { ...s.t.manifest, calculations: [...s.t.manifest.calculations, calc] },
  };
  const ir: FormIR = buildFormIR(t);
  const readers = (id: string) =>
    ir.fields.find((f) => f.id === id)!.dependencies.readBy.filter((d) => d.elementId === ID);
  const why = `${s.slug}: ${b.expression}`;
  if (b.expression.includes('GetDOM')) seen.getDom++;
  if (b.expression.includes('..')) seen.up++;
  if (b.expression.includes('[')) seen.predicate++;
  if (b.literalOnly.length) seen.literal++;
  for (const f of b.inserted) {
    expect(readers(f.id), `${why} → ${f.id}`).toEqual([{ elementId: ID, role: 'calcExpression' }]);
  }
  for (const f of b.literalOnly) expect(readers(f.id), `${why} literal ${f.id}`).toEqual([]);
  expect(ir.calculations.at(-1)!.unresolvedRefs, why).toEqual([]);
}

test('relative paths', () => {
  expect(relative('/a/b/c', '/a/d')).toBe('../../d');
  expect(relative('/a/b', '/a/b/@x')).toBe('@x');
  expect(relative('/a/b', '/a/b')).toBe('.');
});

test(`${RUNS} runs: every inserted field reads the calculation; literals do not`, () => {
  fc.assert(fc.property(p13Input, check), { numRuns: RUNS });
  for (const [k, n] of Object.entries(seen)) expect(n, k).toBeGreaterThan(20);
});

test.each(P13_REGRESSIONS.map((r) => [r.note, r.case] as const))('regression: %s', (_n, p) => {
  check(p);
});
