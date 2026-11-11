#!/usr/bin/env node
// preToolUse on `write` and `shell`: blocks a write, move, copy or delete under samples/.
// The agent file already denies write-tool paths there; this also covers the shell.
import { hook, strings } from './lib.mjs';
import { isAbsolute, relative, resolve } from 'node:path';

const MESSAGE =
  'Blocked by the sample-guard hook: the agent never changes files under samples/ (steering samples-and-licensing.md). Ask the human to change samples.';

const under = (p, cwd) => {
  const r = relative(cwd, resolve(cwd, p));
  return !r.startsWith('..') && !isAbsolute(r) && (r === 'samples' || r.startsWith('samples/'));
};

/** A shell command that can change a path under samples/. */
export function shellTouchesSamples(cmd, cwd = process.cwd()) {
  if (!/samples(\/|\b)/.test(cmd)) return false;
  // Output redirection into samples/.
  for (const m of cmd.matchAll(/>>?\s*("?)([^\s"|;&]+)\1/g)) if (under(m[2], cwd)) return true;
  // Commands that write, move, copy or delete, with a samples/ argument anywhere after them.
  const writers =
    /(^|[;&|(]\s*|\bxargs\s+|\bsudo\s+)(rm|rmdir|mv|cp|rsync|install|touch|mkdir|ln|truncate|tee|chmod|chown|unzip|tar|bsdtar|dd|git\s+(rm|mv|checkout|restore|clean|stash)|sed\s+(-[a-zA-Z]*i|--in-place)|perl\s+-[a-zA-Z]*i)\b([^;&|]*)/g;
  for (const m of cmd.matchAll(writers))
    for (const word of m[0].split(/\s+/)) {
      const w = word.replace(/^["']|["']$/g, '').replace(/^-[A-Za-z]+=/, '');
      if (w.includes('samples') && under(w, cwd)) return true;
    }
  // Scripts that open a samples/ path for writing.
  if (
    /(writeFile|appendFile|open\([^)]*['"]w|unlink|rmSync|renameSync|copyFile)[^;]*samples\//.test(
      cmd,
    )
  )
    return true;
  return false;
}

export function blocks(e) {
  const cwd = e.cwd || process.cwd();
  const input = e.tool_input ?? {};
  // The write tool's own `command` is create, strReplace or insert; only the shell runs one.
  if (e.tool_name === 'shell' || e.tool_name === 'execute_bash')
    return shellTouchesSamples(String(input.command ?? ''), cwd);
  // write: `path`; code pattern_rewrite: `file_path` or `path` (only when not a dry run).
  if (input.operation !== undefined && input.operation !== 'pattern_rewrite') return false;
  if (input.operation === 'pattern_rewrite' && input.dry_run !== false) return false;
  return [input.path, input.file_path].some((p) => typeof p === 'string' && under(p, cwd));
}

if (import.meta.url === `file://${process.argv[1]}`)
  hook((e) => {
    if (!blocks(e)) return 0;
    process.stderr.write(`${MESSAGE}\n`);
    return 2;
  });

export { strings };
