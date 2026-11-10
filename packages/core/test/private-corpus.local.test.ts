// R21.6 (spec 01 addendum, design §15.4): the templates under AFTERLIFE_PRIVATE_SAMPLES parse with
// no throw, no issues and no unknown entries. Local only: those files are unlicensed and never
// enter the repo. Messages and the summary carry codes, kinds, namespaces, names, paths and counts,
// never raw XML, attribute values or text. Nothing is written.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { parseXsn } from '../src/index';

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
const totals = { files: files.length, parsed: 0, issues: 0, unknowns: 0 };

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
  });

  afterAll(() => {
    console.log(
      `private corpus: ${totals.files} files, ${totals.parsed} parsed, ${totals.issues} issues, ${totals.unknowns} unknowns`,
    );
  });
});
