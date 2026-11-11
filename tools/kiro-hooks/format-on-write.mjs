#!/usr/bin/env node
// postToolUse on `write`: `prettier --check` on the written file when it is .ts, .tsx, .css or
// .json and the root config covers it. One line on failure; never rewrites, never blocks.
import { hook } from './lib.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const CHECKED = /\.(ts|tsx|css|json)$/;

export function target(e, root) {
  const p = e.tool_input?.path;
  if (typeof p !== 'string' || !CHECKED.test(p)) return undefined;
  const r = relative(root, resolve(e.cwd || root, p));
  return r.startsWith('..') || isAbsolute(r) ? undefined : r;
}

if (import.meta.url === `file://${process.argv[1]}`)
  hook((e) => {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: e.cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 2000,
    }).trim();
    const file = target(e, root);
    if (!file || !existsSync(join(root, file))) return 0;
    const bin = join(root, 'node_modules', '.bin', 'prettier');
    try {
      // --ignore-unknown: a file the root .prettierignore excludes passes silently.
      execFileSync(bin, ['--check', '--ignore-unknown', '--log-level', 'silent', file], {
        cwd: root,
        timeout: 5000,
        stdio: 'ignore',
      });
    } catch (err) {
      if (err && err.status === 1)
        process.stdout.write(
          `format-on-write: ${file} is not formatted; run \`pnpm exec prettier --write ${file}\` from the repo root.\n`,
        );
    }
    return 0;
  }, 7000);
