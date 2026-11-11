#!/usr/bin/env node
// stop: appends one entry to .kiro/JOURNAL.md: UTC time, files changed since the last commit by
// area (counts only), and the spec task boxes ticked in the working tree. No prose, no prompt
// or response text.
import { hook } from './lib.mjs';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** `packages/core`, `apps/web`, `.kiro/specs`, … : the first one or two path segments. */
export function area(path) {
  const parts = path.split('/');
  if (
    ['packages', 'apps', 'tools'].includes(parts[0]) ||
    (parts[0] === '.kiro' && parts.length > 2)
  )
    return parts.slice(0, 2).join('/');
  return parts.length > 1 ? parts[0] : '(root)';
}

/** Paths from `git status --porcelain` (renames give the new path). */
export function changedPaths(porcelain) {
  return porcelain
    .split('\n')
    .filter((l) => l.length > 3)
    .map((l) =>
      l
        .slice(3)
        .replace(/^.* -> /, '')
        .replace(/^"|"$/g, ''),
    );
}

/** `04-classic-runtime 7/13` per spec: ticked over all task boxes. */
export function tickedLine(spec, text) {
  const all = text.match(/^\s*- \[[ x]\] /gm) ?? [];
  const done = text.match(/^\s*- \[x\] /gm) ?? [];
  return `${spec} ${done.length}/${all.length}`;
}

export function entry(now, paths, ticked) {
  const counts = new Map();
  for (const p of paths) counts.set(area(p), (counts.get(area(p)) ?? 0) + 1);
  const byArea =
    [...counts]
      .sort()
      .map(([a, n]) => `${a} ${n}`)
      .join(', ') || 'none';
  return `- ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC. Changed since last commit: ${byArea}. Tasks ticked: ${ticked.join('; ') || 'none'}.\n`;
}

if (import.meta.url === `file://${process.argv[1]}`)
  hook((e) => {
    const git = (...args) =>
      execFileSync('git', args, { cwd: e.cwd || process.cwd(), encoding: 'utf8', timeout: 2000 });
    const root = git('rev-parse', '--show-toplevel').trim();
    const paths = changedPaths(git('status', '--porcelain', '--untracked-files=all')).filter(
      (p) => p !== '.kiro/JOURNAL.md',
    );
    const ticked = git(
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '.kiro/specs/*/tasks.md',
    )
      .split('\n')
      .filter(Boolean)
      .map((f) =>
        tickedLine(f.split('/')[2], execFileSync('cat', [join(root, f)], { encoding: 'utf8' })),
      );
    const file = join(root, '.kiro', 'JOURNAL.md');
    if (!existsSync(file))
      writeFileSync(
        file,
        '# Journal\n\nOne line per agent turn, written by the journal-on-stop hook (docs/kiro/hooks.md).\n\n',
      );
    appendFileSync(file, entry(new Date(), paths, ticked));
    return 0;
  });
