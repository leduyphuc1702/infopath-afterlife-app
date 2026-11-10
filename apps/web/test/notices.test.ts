import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { readDist } from './dist';

// R7.2: every package in the build's module list (page and Worker) appears in the notices, with
// its licence text; plus the app, samples/own, Peter Theill's notice and Carlito's OFL.
const html = readDist('notices.html').toString('utf8');
const ids = JSON.parse(readDist('.vite/modules.json').toString('utf8')) as string[];

/** Package names, read from the module ids here, independently of plugins/notices.ts. */
const packages = [
  ...new Set(
    ids.flatMap((id) => {
      const m = /.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id);
      return m ? [m[1]!] : [];
    }),
  ),
].sort();

test('the module list covers the page and the Worker', () => {
  for (const p of ['react', 'react-dom', '@atlaskit/tokens', '@fontsource/carlito'])
    expect(packages).toContain(p);
  for (const p of ['xsltjs', 'xpath', '@xmldom/xmldom']) expect(packages).toContain(p);
});

test('every package in the bundles has a section with its version, licence and text', () => {
  for (const name of packages) {
    const id = `pkg-${name.replace(/^@/, '').replace(/\//g, '__')}`;
    const section = new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(html)?.[0];
    expect(section, name).toBeDefined();
    const dir = ids.find((i) => i.includes(`/node_modules/${name}/`))!;
    const pkgDir = dir.slice(
      0,
      dir.indexOf(`/node_modules/${name}/`) + `/node_modules/${name}`.length,
    );
    const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8')) as {
      version: string;
      license: string;
    };
    expect(section, name).toContain(`${name} ${pkg.version}`);
    expect(section, name).toContain(`<strong>${pkg.license}</strong>`);
    expect(section!.length, name).toBeGreaterThan(600); // the licence text is in it
  }
  console.log(`R7.2: ${packages.length} packages: ${packages.join(', ')}`);
});

test('the app, samples/own, weight-keeper (Peter Theill) and Carlito (OFL 1.1)', () => {
  expect(html).toContain('<section id="afterlife"');
  expect(html).toContain('<section id="samples-own"');
  expect(html).toMatch(
    /Weight keeper sample, by Peter Theill[\s\S]*Copyright \(c\) \d{4} Peter Theill/i,
  );
  expect(html).toMatch(/@fontsource\/carlito[\s\S]*SIL Open Font License, Version 1\.1/);
  expect(readDist('licenses/fontsource__carlito.txt').toString('utf8')).toContain(
    'SIL OPEN FONT LICENSE Version 1.1',
  );
});

test('the notices page carries the same CSP as the app', () => {
  const index = readDist('index.html').toString('utf8');
  const csp = (h: string) =>
    /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
      .exec(h)?.[1]
      ?.replace(/&#39;|&apos;/g, "'");
  expect(csp(html)).toBe(csp(index));
});
