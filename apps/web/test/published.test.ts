import { readdirSync, readFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { DIST } from './dist';

// Design §7: `dist` is what gets published. It holds no dot-entry (`.vite/`, `.DS_Store`, …)
// and no string that names a path on the build machine: the repo root, the home directory, the
// user name in a home path, or any absolute home path at all.
const entries = readdirSync(DIST, { recursive: true }).map(String);
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');
const HOME = homedir();
const USER = userInfo().username;
const ABSOLUTE =
  /(?:\/Users\/|\/home\/|\/root\/|\/private\/var\/|[A-Za-z]:[\\/]+Users[\\/])[\w.-]+/;

test('no dot-entry anywhere in dist', () => {
  expect(entries.filter((p) => p.split(/[\\/]/).some((part) => part.startsWith('.')))).toEqual([]);
});

test('no build-machine path in any file of dist', () => {
  const found: string[] = [];
  for (const rel of entries) {
    const file = new URL(rel, DIST);
    let text: string;
    try {
      text = readFileSync(file, 'latin1');
    } catch {
      continue; // a directory
    }
    for (const needle of [ROOT, HOME, `/${USER}/`, `\\${USER}\\`])
      if (text.includes(needle)) found.push(`${rel}: ${needle}`);
    const m = ABSOLUTE.exec(text);
    if (m) found.push(`${rel}: ${m[0]}`);
  }
  expect(found).toEqual([]);
});

test('the oracle finds what it looks for', () => {
  for (const s of ['/Users/ana/x', '/home/ana/x', 'C:\\Users\\ana\\x', `${HOME}/x`])
    expect(ABSOLUTE.test(s) || s.includes(HOME), s).toBe(true);
  expect(ABSOLUTE.test('./assets/worker-x.js')).toBe(false);
});
