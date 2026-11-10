import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

// Spec 03 R3.4 (third review): every production dependency of packages/core, transitive ones
// included, is under MIT, Apache-2.0, BSD or ISC terms, with no exception. The licence is read
// offline from each installed package.json; pnpm-lock.yaml has no licence field.

const ALLOWED = /^(MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|0BSD|ISC)$/;
const coreDir = fileURLToPath(new URL('../../', import.meta.url));

interface Manifest {
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const readManifest = (dir: string) =>
  JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;

/** Node's lookup: `node_modules/<name>` in this folder or any parent (pnpm symlinks resolved). */
function packageDir(name: string, from: string): string {
  for (let dir = from; ; dir = dirname(dir)) {
    const inside = dir.endsWith('/node_modules')
      ? join(dir, name)
      : join(dir, 'node_modules', name);
    try {
      return realpathSync(inside);
    } catch {
      if (dirname(dir) === dir) throw new Error(`${name} is not installed (from ${from})`);
    }
  }
}

function productionDependencies(): Manifest[] {
  const seen = new Map<string, Manifest>();
  const visit = (dir: string) => {
    const m = readManifest(dir);
    for (const name of Object.keys({ ...m.dependencies, ...m.optionalDependencies })) {
      const depDir = packageDir(name, dir);
      if (seen.has(depDir)) continue;
      seen.set(depDir, readManifest(depDir));
      visit(depDir);
    }
  };
  visit(realpathSync(coreDir));
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

test('every production dependency of packages/core has an allowed licence', () => {
  const deps = productionDependencies();
  expect(deps.map((d) => `${d.name}@${d.version} ${d.license ?? '(none)'}`)).toEqual([
    '@xmldom/xmldom@0.9.12 MIT',
    'xpath@0.0.36 MIT',
    'xsltjs@1.0.0 MIT',
  ]);
  for (const d of deps) expect(d.license ?? '', d.name).toMatch(ALLOWED);
});
