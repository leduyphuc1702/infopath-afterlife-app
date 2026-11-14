// Puts the product page (site/) beside the built app, at apps/web/dist/about/, so one Pages
// deployment serves both. Only the files git tracks are copied: a local run and the Pages
// workflow publish the same set, and the page checker's working files stay out.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'apps/web/dist');
if (!existsSync(join(dist, 'index.html'))) {
  throw new Error('apps/web/dist is not built: run `pnpm --filter web build` first');
}

const files = execFileSync('git', ['ls-files', '-z', 'site'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter((f) => f !== '' && !f.startsWith('site/.taste-skill/'));
if (!files.includes('site/index.html')) throw new Error('site/index.html is not tracked by git');

const out = join(dist, 'about');
rmSync(out, { recursive: true, force: true });
for (const f of files) {
  const to = join(out, f.slice('site/'.length));
  mkdirSync(dirname(to), { recursive: true });
  cpSync(join(root, f), to);
}
process.stdout.write(`about: ${files.length} files copied to apps/web/dist/about\n`);
