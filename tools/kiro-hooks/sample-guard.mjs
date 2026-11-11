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

const words = (seg) =>
  seg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^["']|["']$/g, ''));
const unquote = (args) => args.map((w) => w.replace(/^-[A-Za-z-]+=/, ''));
const option = (args, names) => {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    for (const n of names) {
      if (a === n) return args[i + 1];
      if (n.startsWith('--') && a.startsWith(`${n}=`)) return a.slice(n.length + 1);
    }
  }
  return undefined;
};

/** Whether `cmd` with `args` writes to a path under samples/. */
function writesUnder(cmd, args, cwd) {
  const hit = (p) => typeof p === 'string' && p.includes('samples') && under(p, cwd);
  // Paths are judged against the event's cwd, the repo root; an extract with no target writes there.
  const here = false;
  switch (cmd) {
    case 'cp':
    case 'rsync':
    case 'install':
    case 'ln': {
      // Only the destination counts: the `-t` directory, or the last path argument.
      const t = option(args, ['-t', '--target-directory']);
      if (t !== undefined) return hit(t);
      const paths = args.filter((a) => !a.startsWith('-'));
      return paths.length > 0 && hit(paths[paths.length - 1]);
    }
    case 'tar':
    case 'bsdtar': {
      const mode = args.find((a) => !a.startsWith('--')) ?? '';
      const extract =
        args.includes('--extract') || args.includes('--get') || /^-?[A-Za-z]*x/.test(mode);
      if (extract) {
        const dir = option(args, ['-C', '--directory', '--cd']);
        return dir === undefined ? here : hit(dir);
      }
      // Creating or appending: only the archive file is written.
      const create =
        /^-?[A-Za-z]*[cru]/.test(mode) || args.some((a) => /^--(create|append|update)$/.test(a));
      if (!create) return false;
      const fIndex = args.findIndex((a) => /^-?[A-Za-z]*f$/.test(a) && !a.startsWith('--'));
      const f = option(args, ['--file']) ?? (fIndex >= 0 ? args[fIndex + 1] : undefined);
      return f === undefined ? here : hit(f);
    }
    case 'unzip': {
      const d = option(args, ['-d']);
      return d === undefined ? here : hit(d);
    }
    default:
      // rm, mv (either side), touch, mkdir, sed -i, git checkout/restore/clean, …: any argument.
      return unquote(args).some(hit);
  }
}

/** A shell command that can change a path under samples/. */
export function shellTouchesSamples(cmd, cwd = process.cwd()) {
  if (!/samples(\/|\b)/.test(cmd)) return false;
  // Output redirection into samples/.
  for (const m of cmd.matchAll(/>>?\s*("?)([^\s"|;&]+)\1/g)) if (under(m[2], cwd)) return true;
  // Commands that write, move, copy or delete, each judged on the arguments it writes to.
  const writers =
    /(^|[;&|(]\s*|\bxargs\s+|\bsudo\s+)(rm|rmdir|mv|cp|rsync|install|touch|mkdir|ln|truncate|tee|chmod|chown|unzip|tar|bsdtar|dd|git\s+(rm|mv|checkout|restore|clean|stash)|sed\s+(-[a-zA-Z]*i|--in-place)|perl\s+-[a-zA-Z]*i)\b([^;&|]*)/g;
  for (const m of cmd.matchAll(writers))
    if (writesUnder(m[2].split(/\s+/)[0], words(m[0]).slice(m[2].split(/\s+/).length), cwd))
      return true;
  // Scripts that open a samples/ path for writing, on one line: a heredoc's other lines may only
  // read samples/.
  if (
    /(writeFile|appendFile|open\([^)]*['"]w|unlink|rmSync|renameSync|copyFile)[^;\n]*samples\//.test(
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
