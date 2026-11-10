// Dev only (spec 03 task 10, R10.1, design §10): writes the `xsltproc` references the renderer's
// fallback output is compared with. Run with `pnpm --filter @afterlife/core gen:xsltproc-refs`
// on a machine with /usr/bin/xsltproc; CI only reads the committed output.
//
// For each of the 53 views (every `xsf:mainpane` of forms 01–47 and the public sample) and each
// of its two records (empty and first), runs `/usr/bin/xsltproc --nonet <view> <record>` and
// writes its raw output to test/golden/render/xsltproc/<slug>/<view stem>.<empty|first>.html,
// next to VERSION.txt (`xsltproc --version` and the date). Our forms are read from their
// unpacked folders under samples/own/forms/; the public sample is unpacked with bsdtar into a
// temporary folder, deleted afterwards. Nothing under samples/ is written.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOMParser, type Element } from '@xmldom/xmldom';

const XSLTPROC = '/usr/bin/xsltproc';
const BSDTAR = '/usr/bin/bsdtar';
const XSF = 'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition';
const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = new URL('../test/golden/render/xsltproc/', import.meta.url).pathname;
const OWN = join(ROOT, 'samples/own/');
const PUBLIC_XSN = join(ROOT, 'samples/public/theill-weight-keeper/theill__weight-keeper.xsn');

interface Form {
  readonly slug: string;
  /** The unpacked package. */
  readonly dir: string;
  readonly records: { readonly empty: string; readonly first: string };
}

/** A file of `dir` by name, ignoring case (spec 01 R6.2). */
function fileIn(dir: string, name: string): string {
  const found = readdirSync(dir).find((f) => f.toLowerCase() === name.toLowerCase());
  if (found === undefined) throw new Error(`${dir}: no file ${name}`);
  return join(dir, found);
}

/** `mainpane/@transform` of every view, in manifest order, as viewCases() reads them. */
function mainpanes(dir: string): string[] {
  const xsf = new DOMParser().parseFromString(
    readFileSync(fileIn(dir, 'manifest.xsf'), 'utf8'),
    'text/xml',
  );
  const out: string[] = [];
  const views = xsf.getElementsByTagNameNS(XSF, 'view');
  for (let i = 0; i < views.length; i++) {
    const view = views.item(i)!;
    const pane = [...childElements(view)].find(
      (e) => e.namespaceURI === XSF && e.localName === 'mainpane',
    );
    const transform = pane?.getAttribute('transform');
    if (transform) out.push(transform);
  }
  return out;
}

function* childElements(el: Element): Generator<Element> {
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) yield n as Element;
}

const run = (file: string, args: string[]) =>
  execFileSync(file, args, { maxBuffer: 64 * 1024 * 1024 });

const temp = mkdtempSync(join(tmpdir(), 'afterlife-xsltproc-'));
try {
  run(BSDTAR, ['-xf', PUBLIC_XSN, '-C', temp]);
  const forms: Form[] = readdirSync(join(OWN, 'xsn'))
    .filter((f) => f.endsWith('.xsn'))
    .sort()
    .map((f) => {
      const slug = f.slice(0, -'.xsn'.length);
      const records = join(OWN, 'records', slug);
      return {
        slug,
        dir: join(OWN, 'forms', slug),
        records: {
          empty: join(records, `${slug}-000-empty.xml`),
          first: join(records, `${slug}-001.xml`),
        },
      };
    });
  forms.push({
    slug: 'theill-weight-keeper',
    dir: temp,
    records: { empty: fileIn(temp, 'template.xml'), first: fileIn(temp, 'sampledata.xml') },
  });

  rmSync(OUT, { recursive: true, force: true });
  let views = 0;
  let files = 0;
  for (const form of forms) {
    mkdirSync(join(OUT, form.slug), { recursive: true });
    for (const xsl of mainpanes(form.dir)) {
      views++;
      for (const record of ['empty', 'first'] as const) {
        const html = run(XSLTPROC, ['--nonet', fileIn(form.dir, xsl), form.records[record]]);
        writeFileSync(join(OUT, form.slug, `${xsl.replace(/\.xsl$/i, '')}.${record}.html`), html);
        files++;
      }
    }
  }
  const version = run(XSLTPROC, ['--version']).toString('utf8');
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(OUT, 'VERSION.txt'),
    `${XSLTPROC} --version\n${version}\nCommand: ${XSLTPROC} --nonet <view> <record>\n` +
      `Generated: ${date}, ${views} views, ${files} files\n`,
  );
  console.log(`${views} views, ${files} references in ${OUT}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
