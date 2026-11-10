// R21.6 (spec 01 addendum, design §15.4): the templates under AFTERLIFE_PRIVATE_SAMPLES parse with
// no throw, no issues and no unknown entries. Spec 02 R1.4 (task 13): buildFormIR returns for each,
// and the FormIR issues are exactly the expected counts below. Local only: those files are unlicensed and never
// enter the repo. Messages and the summary carry codes, kinds, namespaces, names, paths and counts,
// never raw XML, attribute values or text. Nothing is written.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { buildFormIR, parseXsn } from '../src/index';

const root = process.env.AFTERLIFE_PRIVATE_SAMPLES;

function xsnFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...xsnFiles(path));
    else if (/\.xsn$/i.test(name)) out.push(path);
  }
  return out;
}

const files = root
  ? xsnFiles(root).sort((a, b) => relative(root, a).localeCompare(relative(root, b)))
  : [];
const totals = { files: files.length, parsed: 0, issues: 0, unknowns: 0, built: 0 };

/** Spec 02 task 13: the FormIR issues expected after the task 10 fixes, by code and reason. */
const EXPECTED_IR_ISSUES = {
  'UNRESOLVED_REFERENCE stringExpression': 12,
  'UNRESOLVED_REFERENCE axis': 3,
  'UNRESOLVED_BINDING notInTree': 3,
};

const counts = {
  irIssues: {} as Record<string, number>,
  generation: {} as Record<string, number>,
  labelSource: {} as Record<string, number>,
  bindingByXctname: {} as Record<string, number>,
  referenceByRole: {} as Record<string, number>,
};
const bump = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);
const line = (m: Record<string, number>) =>
  Object.keys(m)
    .sort()
    .map((k) => `${k} ${m[k]}`)
    .join(', ') || 'none';

describe.skipIf(!root)('private corpus (AFTERLIFE_PRIVATE_SAMPLES)', () => {
  test.each(files.map((f) => [relative(root!, f), f]))('%s', async (_name, path) => {
    const t = await parseXsn(new Uint8Array(readFileSync(path)));
    totals.parsed++;
    totals.issues += t.issues.length;
    totals.unknowns += t.unknowns.length;
    expect(t.issues.map((i) => ({ code: i.code }))).toEqual([]);
    expect(
      t.unknowns.map((u) => ({ kind: u.kind, namespace: u.namespace, name: u.name, path: u.path })),
    ).toEqual([]);

    const ir = buildFormIR(t);
    totals.built++;
    bump(counts.generation, ir.meta.generation);
    for (const f of ir.fields) bump(counts.labelSource, f.labelSource);
    const controls = ir.views.flatMap((v) => v.controls);
    for (const i of ir.issues.slice(t.issues.length)) {
      const reason = String(i.details?.reason ?? '');
      bump(counts.irIssues, `${i.code} ${reason}`.trim());
      if (i.code === 'UNRESOLVED_BINDING') {
        const c = controls.find((x) => x.id === i.details?.elementId);
        bump(counts.bindingByXctname, `${reason} ${c?.xctname ?? '(none)'}`);
      } else if (i.code === 'UNRESOLVED_REFERENCE') {
        bump(counts.referenceByRole, `${reason} ${String(i.details?.role ?? '')}`);
      }
    }
  });

  test('spec 02 R1.4: FormIR issues are exactly the expected counts', () => {
    expect(totals.built).toBe(totals.files);
    expect(counts.irIssues).toEqual(EXPECTED_IR_ISSUES);
  });

  afterAll(() => {
    console.log(
      [
        `private corpus: ${totals.files} files, ${totals.parsed} parsed, ${totals.issues} issues, ${totals.unknowns} unknowns`,
        `FormIR built: ${totals.built}`,
        `FormIR issues: ${line(counts.irIssues)}`,
        `generation: ${line(counts.generation)}`,
        `labelSource: ${line(counts.labelSource)}`,
        `UNRESOLVED_BINDING by reason and xctname: ${line(counts.bindingByXctname)}`,
        `UNRESOLVED_REFERENCE by reason and role: ${line(counts.referenceByRole)}`,
      ].join('\n'),
    );
  });
});
