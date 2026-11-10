// Spec 09 R7.2, design §7: the notices page. Every package whose code or files end up in the
// built bundles (the page and the Worker) is collected from the module ids of both builds; each
// one's licence is read from its own `package.json` and licence file in `node_modules`. The build
// fails on a licence outside the allowed set, or on a package with no licence text.
//
// Output: `notices.html` (static, under the same CSP as the app), `notices.css` and
// `notices-theme.js` (the colour mode, as `shell/theme.ts` sets it), `licenses/<package>.txt`,
// The module ids go to `apps/web/build-meta/modules.json` (git-ignored, outside `dist`), made
// relative to the repo root, for `test/notices.test.ts`: nothing published names a build-machine
// path (design §7).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import dark from '@atlaskit/tokens/dist/esm/artifacts/themes/atlassian-dark.js';
import light from '@atlaskit/tokens/dist/esm/artifacts/themes/atlassian-light.js';
import spacing from '@atlaskit/tokens/dist/esm/artifacts/themes/atlassian-spacing.js';
import { CSP } from './csp.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const BUILD_META = fileURLToPath(new URL('../build-meta/', import.meta.url));

/** A module id relative to the repo root, without the virtual-module marker or a query. */
export const repoRelative = (id: string) => {
  const path = id.replace(/^\0/, '').replace(/[?#].*$/, '');
  return isAbsolute(path) ? relative(ROOT, path).split('\\').join('/') : path;
};
const ALLOWED = /^(MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|ISC|OFL-1\.1)$/;
const LICENCE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i;
const NOTICE_FILE = /^notice(\.(md|txt))?$/i;

/** `…/node_modules/.pnpm/x@1/node_modules/@scope/name/lib/a.js` → its package directory. */
export function packageDir(id: string): string | undefined {
  const path = id.replace(/^\0/, '').replace(/[?#].*$/, '');
  const at = path.lastIndexOf('/node_modules/');
  if (at < 0) return undefined;
  const rest = path.slice(at + '/node_modules/'.length).split('/');
  const n = rest[0]?.startsWith('@') ? 2 : 1;
  if (rest.length < n) return undefined;
  return path.slice(0, at + '/node_modules/'.length) + rest.slice(0, n).join('/');
}

export interface PackageNotice {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
  readonly notice?: string;
}

function readPackage(dir: string): PackageNotice {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
    license?: string | { type: string };
  };
  const license = typeof pkg.license === 'object' ? pkg.license.type : (pkg.license ?? '');
  const files = readdirSync(dir);
  const file = files.find((f) => LICENCE_FILE.test(f));
  const notice = files.find((f) => NOTICE_FILE.test(f));
  return {
    name: pkg.name,
    version: pkg.version,
    license,
    text: file ? readFileSync(join(dir, file), 'utf8') : '',
    ...(notice && { notice: readFileSync(join(dir, notice), 'utf8') }),
  };
}

/** A licence expression is allowed when one of its `OR` terms is. */
const allowed = (license: string) =>
  license
    .replace(/[()]/g, '')
    .split(/\s+OR\s+/)
    .some((t) => ALLOWED.test(t.trim()));

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (name: string) => name.replace(/^@/, '').replace(/\//g, '__');

interface Section {
  readonly id: string;
  readonly title: string;
  readonly what: string;
  readonly license: string;
  readonly text: string;
  readonly file: string;
}

function page(sections: readonly Section[]): string {
  const body = sections
    .map(
      (s) => `<section id="${s.id}" aria-labelledby="${s.id}-h">
<h2 id="${s.id}-h">${esc(s.title)}</h2>
<p>${esc(s.what)} Licence: <strong>${esc(s.license)}</strong>. <a href="./licenses/${s.file}">Plain text</a></p>
<details><summary>Licence text</summary><pre>${esc(s.text)}</pre></details>
</section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en" data-theme="light:light dark:dark spacing:spacing" data-color-mode="light">
<head>
<meta http-equiv="Content-Security-Policy" content="${esc(CSP)}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Licences and notices: InfoPath Afterlife</title>
<link rel="icon" href="./favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="./notices.css">
<script src="./notices-theme.js"></script>
</head>
<body>
<main>
<p><a href="./">Back to the viewer</a></p>
<h1>Licences and notices</h1>
<p>InfoPath Afterlife is open source under the MIT licence. It ships the code, fonts and sample forms below, each under its own licence.</p>
<p>InfoPath is a trademark of Microsoft. This project is not affiliated with Microsoft or Atlassian.</p>
${body}
</main>
</body>
</html>
`;
}

/**
 * One collector shared by the page build and the Worker build (`vite.config.ts` gives the same
 * instance to both). The Worker is bundled while the page build transforms its importer, so its
 * module ids are in before the page build's `generateBundle` writes the notices.
 */
export function notices(): { readonly collect: Plugin; readonly write: Plugin } {
  const ids = new Set<string>();
  const collect: Plugin = {
    name: 'afterlife:notices-collect',
    apply: 'build',
    generateBundle() {
      for (const id of this.getModuleIds()) ids.add(id);
    },
  };
  const write: Plugin = {
    name: 'afterlife:notices',
    apply: 'build',
    generateBundle() {
      for (const id of this.getModuleIds()) ids.add(id);
      const dirs = [...new Set([...ids].flatMap((id) => packageDir(id) ?? []))];
      const packages = dirs
        .map(readPackage)
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const p of packages) {
        if (!allowed(p.license))
          this.error(
            `notices: ${p.name}@${p.version} is under "${p.license}", not an allowed licence`,
          );
        if (p.text.trim() === '') this.error(`notices: ${p.name}@${p.version} has no licence file`);
      }
      const own = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
      const sections: Section[] = [
        {
          id: 'afterlife',
          title: 'InfoPath Afterlife',
          what: 'This viewer and its form engine (@afterlife/core).',
          license: 'MIT',
          text: own('LICENSE'),
          file: 'afterlife.txt',
        },
        {
          id: 'samples-own',
          title: 'Sample forms 01–08 and their records',
          what: 'Written for this project; every person, company and host in them is fictional.',
          license: 'MIT',
          text: own('samples/own/LICENSE'),
          file: 'samples-own.txt',
        },
        {
          id: 'weight-keeper',
          title: 'Weight keeper sample, by Peter Theill',
          what: 'theill__weight-keeper.xsn, from github.com/theill/iquomi.',
          license: 'MIT',
          text: own('samples/public/theill-weight-keeper/LICENSE'),
          file: 'theill-weight-keeper.txt',
        },
        ...packages.map((p) => ({
          id: `pkg-${slug(p.name)}`,
          title: `${p.name} ${p.version}`,
          what:
            p.name === '@fontsource/carlito'
              ? 'Carlito, the font that stands in for Calibri on the paper, shipped unmodified.'
              : 'A package in the built page or Worker.',
          license: p.license,
          text: p.notice ? `${p.text}\n\n---- NOTICE ----\n\n${p.notice}` : p.text,
          file: `${slug(p.name)}.txt`,
        })),
      ];
      for (const s of sections)
        this.emitFile({ type: 'asset', fileName: `licenses/${s.file}`, source: s.text });
      this.emitFile({ type: 'asset', fileName: 'notices.html', source: page(sections) });
      const css = readFileSync(
        fileURLToPath(new URL('../src/shell/notices.css', import.meta.url)),
        'utf8',
      );
      this.emitFile({
        type: 'asset',
        fileName: 'notices.css',
        source: [light, dark, spacing, css].join('\n'),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'notices-theme.js',
        source:
          "document.documentElement.dataset.colorMode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';\n",
      });
      mkdirSync(BUILD_META, { recursive: true });
      writeFileSync(
        join(BUILD_META, 'modules.json'),
        JSON.stringify([...new Set([...ids].map(repoRelative))].sort(), null, 1),
      );
    },
  };
  return { collect, write };
}
