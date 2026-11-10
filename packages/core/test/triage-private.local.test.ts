// Spec 12 R8.1 (task 4): triage every template and record under AFTERLIFE_PRIVATE_SAMPLES, except
// the `own/` folder (our forms, covered by the in-repo tests). Local only: those files are
// unlicensed and never enter the repo. The summary prints counts only: templates, error rows by
// code, waves, causes per id, items per class, and unlisted elements by kind and subtype (a type
// name such as an `xctname` or an adapter kind). Never a file name, title, URN, host or path.
// Nothing is written. Without the variable the suite is skipped.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  buildFormIR,
  CAUSE_IDS,
  classify,
  COVERAGE_CLASSES,
  parseXsn,
  triageFiles,
  type TriageRow,
} from '../src/index';

const root = process.env.AFTERLIFE_PRIVATE_SAMPLES;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(xsn|xml)$/i.test(name)) out.push(path);
  }
  return out;
}

const bump = (m: Record<string, number>, k: string, n = 1) => (m[k] = (m[k] ?? 0) + n);
const line = (m: Record<string, number>) =>
  Object.keys(m)
    .sort()
    .map((k) => `${k} ${m[k]}`)
    .join(', ') || 'none';

describe.runIf(root !== undefined)('private corpus triage (counts only)', () => {
  test('every template triages; the summary holds counts only', async () => {
    const paths = files(root!).filter((f) => !relative(root!, f).split(sep).includes('own'));
    // Names are replaced by their index, so nothing from the corpus reaches the output; the
    // extension is kept, because triageFiles sorts templates from records by it.
    const input = paths.map((p, i) => ({
      name: `f${String(i).padStart(4, '0')}${p.slice(p.lastIndexOf('.')).toLowerCase()}`,
      bytes: new Uint8Array(readFileSync(p)),
    }));
    const res = await triageFiles(input);

    const errors: Record<string, number> = {};
    for (const r of res.rows) if (r.kind === 'error') bump(errors, r.code);
    const classes: Record<string, number> = {};
    const unlisted: Record<string, number> = {};
    for (const f of input.filter((x) => x.name.endsWith('.xsn'))) {
      let ir;
      try {
        ir = buildFormIR(await parseXsn(f.bytes));
      } catch {
        continue; // counted as an error row above
      }
      for (const it of classify(ir).items) {
        bump(classes, it.class);
        if (it.unlisted) bump(unlisted, `${it.kind}:${it.subtype || '(none)'}`);
      }
    }
    const rows = res.rows.filter((r): r is TriageRow => r.kind === 'form');
    const t = res.totals;
    console.log(
      [
        `Spec 12 private triage: ${input.filter((f) => f.name.endsWith('.xsn')).length} templates, ` +
          `${input.length - input.filter((f) => f.name.endsWith('.xsn')).length} records`,
        `rows ${t.forms}, error rows ${t.errors} (${line(errors)})`,
        `waves: 1 ${t.waves[1]}, 2 ${t.waves[2]}, 3 ${t.waves[3]}`,
        `causes: ${CAUSE_IDS.map((id) => `${id} ${t.causes[id]}`).join(', ')}`,
        `items: ${COVERAGE_CLASSES.map((c) => `${c} ${classes[c] ?? 0}`).join(', ')}`,
        `unlisted: ${line(unlisted)}`,
        `records matched: ${rows.reduce((n, r) => n + (r.records ?? 0), 0)}`,
      ].join('\n'),
    );
    expect(t.forms + t.errors).toBe(input.filter((f) => f.name.endsWith('.xsn')).length);
  }, 600_000);
});
