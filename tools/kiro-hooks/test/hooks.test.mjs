// pnpm test:hooks (node --test tools/kiro-hooks/test/*.test.mjs): the hook logic, then each script run as the CLI runs it.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findSecrets } from '../no-secrets.mjs';
import { blocks, shellTouchesSamples } from '../sample-guard.mjs';
import { target } from '../format-on-write.mjs';
import { area, changedPaths, entry, tickedLine } from '../journal-on-stop.mjs';

const dir = dirname(dirname(fileURLToPath(import.meta.url)));
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const run = (script, event) =>
  spawnSync('node', [join(dir, script)], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    timeout: 10000,
  });
// Fake tokens, built so this file holds none.
const tok = (a, b) => a + b;

test('no-secrets: each pattern found, by name only', () => {
  const cases = [
    tok('ATATT3xFf', 'GF0abcdefghijklmnopqrstuvwx'),
    tok('ghp_', 'a'.repeat(36)),
    tok('github_pat_', '1'.repeat(40)),
    tok('AKIA', 'ABCDEFGHIJKLMNOP'),
    tok('-----BEGIN RSA ', 'PRIVATE KEY-----'),
    tok('https://abc123.hello.atlassian-dev', '.net/x1/AbCdEfGhIjKlMn'),
  ];
  for (const c of cases)
    assert.equal(findSecrets({ content: `x ${c} y` }).length, 1, c.slice(0, 6));
  assert.deepEqual(findSecrets({ content: 'ATATT is a prefix; AKIA too; ghp_short' }), []);
});

test('sample-guard: copies and archives that only read samples/ pass; writes into it are blocked', () => {
  for (const c of [
    'cp samples/own/xsn/02-expense-report.xsn /tmp/x.xsn',
    'cp -r samples/own/xsn /tmp/xsn',
    'rsync -a samples/own/ /tmp/own/',
    'install -m 644 samples/own/README.md /tmp/r.md',
    'ln -s "$PWD/samples/own" /tmp/own',
    'tar -czf /tmp/s.tgz samples/own/xsn',
    'tar czf /tmp/s.tgz samples/own',
    'tar -xzf samples/own/a.tgz -C /tmp/out',
    'unzip samples/own/a.zip -d /tmp/out',
  ])
    assert.equal(shellTouchesSamples(c, '/repo'), false, c);
  for (const c of [
    'cp /tmp/x.xsn samples/own/xsn/',
    'cp -t samples/own a b',
    'rsync -a /tmp/own/ samples/own/',
    'ln -s /tmp/x samples/own/x',
    'tar -xzf /tmp/s.tgz -C samples/own',
    'tar --extract -f /tmp/s.tgz --directory=samples/own',
    'tar -czf samples/own/s.tgz src',
    'unzip /tmp/a.zip -d samples/own',
    'mv samples/own/a.xml /tmp/',
    'touch samples/own/x',
    'mkdir samples/own/new',
    'git restore samples/own',
    'git clean -fd samples/',
  ])
    assert.equal(shellTouchesSamples(c, '/repo'), true, c);
  // A heredoc that writes a file elsewhere and reads samples/ on a later line.
  const heredoc = [
    "python3 - <<'EOF'",
    "open(p, 'w').write(s)",
    'EOF',
    'grep -c x samples/own/a.xml',
  ];
  assert.equal(shellTouchesSamples(heredoc.join('\n'), '/repo'), false);
});

test('sample-guard: shell writes under samples/ are blocked, reads are not', () => {
  for (const c of [
    'rm samples/own/x.xml',
    'echo a > samples/own/x',
    'mv a.xml samples/own/records/',
    'cp -r out samples/public',
    "sed -i '' s/a/b/ samples/own/README.md",
    'cd x && git checkout samples/own',
    'node -e "fs.writeFileSync(\'samples/own/a\', 1)"',
  ])
    assert.equal(shellTouchesSamples(c, root), true, c);
  for (const c of [
    'grep -r x samples/own',
    'cat samples/own/README.md > /tmp/r',
    'ls samples',
    'cp samples/own/a.xml /tmp/a.xml'.replace('cp', 'cat'),
  ])
    assert.equal(shellTouchesSamples(c, root), false, c);
  assert.equal(
    blocks({
      cwd: root,
      tool_name: 'write',
      tool_input: { command: 'create', path: 'samples/own/x' },
    }),
    true,
  );
  assert.equal(
    blocks({ cwd: root, tool_name: 'write', tool_input: { command: 'create', path: 'docs/x.md' } }),
    false,
  );
  assert.equal(
    blocks({
      cwd: root,
      tool_name: 'code',
      tool_input: { operation: 'pattern_search', file_path: 'samples/own' },
    }),
    false,
  );
});

test('format-on-write: only .ts, .tsx, .css, .json inside the repo', () => {
  assert.equal(
    target({ cwd: root, tool_input: { path: 'apps/web/src/a.tsx' } }, root),
    'apps/web/src/a.tsx',
  );
  assert.equal(target({ cwd: root, tool_input: { path: 'docs/a.md' } }, root), undefined);
  assert.equal(target({ cwd: root, tool_input: { path: '/tmp/a.ts' } }, root), undefined);
});

test('journal-on-stop: areas, counts and ticks; no text from the event', () => {
  assert.deepEqual(
    changedPaths(' M apps/web/src/a.ts\n?? tools/kiro-hooks/x.mjs\nR  a -> docs/b.md\n'),
    ['apps/web/src/a.ts', 'tools/kiro-hooks/x.mjs', 'docs/b.md'],
  );
  assert.equal(area('.kiro/specs/04/tasks.md'), '.kiro/specs');
  assert.equal(tickedLine('04', '- [x] 1. a\n- [ ] 2. b\n  - [x] 2.1 c\n'), '04 2/3');
  assert.equal(
    entry(new Date('2026-11-11T04:30:00Z'), ['apps/web/a', 'apps/web/b', 'README.md'], ['04 7/13']),
    '- 2026-11-11 04:30 UTC. Changed since last commit: (root) 1, apps/web 2. Tasks ticked: 04 7/13.\n',
  );
});

test('the scripts as the CLI runs them: exit codes and messages', () => {
  const secret = run('no-secrets.mjs', {
    tool_name: 'write',
    tool_input: { content: tok('ghp_', 'b'.repeat(36)) },
  });
  assert.equal(secret.status, 2);
  assert.match(secret.stderr, /a GitHub token \(ghp_…\)/);
  assert.doesNotMatch(secret.stderr, /bbbb/);
  assert.equal(
    run('no-secrets.mjs', { tool_name: 'write', tool_input: { content: 'hello' } }).status,
    0,
  );
  assert.equal(
    run('sample-guard.mjs', {
      cwd: root,
      tool_name: 'shell',
      tool_input: { command: 'rm samples/own/a' },
    }).status,
    2,
  );
  assert.equal(
    run('sample-guard.mjs', {
      cwd: root,
      tool_name: 'shell',
      tool_input: { command: 'ls samples' },
    }).status,
    0,
  );
  assert.equal(
    run('format-on-write.mjs', {
      cwd: root,
      tool_name: 'write',
      tool_input: { path: 'package.json' },
    }).status,
    0,
  );
  // Bad input never breaks a turn.
  for (const s of ['no-secrets.mjs', 'sample-guard.mjs', 'format-on-write.mjs'])
    assert.equal(
      spawnSync('node', [join(dir, s)], { input: 'not json', timeout: 10000 }).status,
      0,
      s,
    );
});
