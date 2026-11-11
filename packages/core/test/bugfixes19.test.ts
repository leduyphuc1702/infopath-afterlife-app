// Spec 19: bugs in the records list, the archive and the dossier, found by looking (turn 69).
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  archiveRecords,
  buildDossier,
  buildFormIR,
  dossierMarkdown,
  mdText,
  parseXsn,
  prepareView,
  readZip,
  recordList,
  renderView,
  type FormIR,
} from '../src/index';
import { recordsOf } from './legacy/records';

const OWN = new URL('../../../samples/own/', import.meta.url);
const NOW = '2026-11-11T15:00:00+07:00';
const dec = new TextDecoder();
const open = async (slug: string) => {
  const t = await parseXsn(readFileSync(new URL(`xsn/${slug}.xsn`, OWN)));
  return { t, ir: buildFormIR(t) };
};
const unzip = async (b: Uint8Array) =>
  new Map(
    await Promise.all(
      readZip(b, { limits: { entries: 100_000 } })
        .filter((e) => !e.directory)
        .map(async (e) => [e.name, dec.decode(await e.read())] as const),
    ),
  );

/** Form 06 record 1 with a link, an input and a button inside "What happened" (rich text). */
async function hostile06() {
  const { t, ir } = await open('06-safety-incident');
  const rec = recordsOf('06-safety-incident')[0]!;
  const xml = dec
    .decode(rec.bytes)
    .replace(
      /(<my:incidentDescription[^>]*>)/,
      '$1<a xmlns="http://www.w3.org/1999/xhtml" href="http://evil.example/out">out link</a>' +
        '<input xmlns="http://www.w3.org/1999/xhtml" value="v"/><button xmlns="http://www.w3.org/1999/xhtml">Press</button>',
    );
  return { t, ir, record: { fileName: rec.fileName, bytes: new TextEncoder().encode(xml) } };
}

test('A1: rich text holds no form control, on the paper and in the archive', async () => {
  const { t, ir, record } = await hostile06();
  const p = await prepareView(t, ir, { view: ir.views[0]!.name });
  const html = renderView(p, { now: NOW, record: record.bytes }).html;
  const rich = /<span class="xdRichTextBox"[\s\S]*?<\/span><\/div>/.exec(html)![0];
  expect(rich).not.toMatch(/<(input|button|select|textarea)\b/);
  expect(rich).toContain('Press');
});

test('A1: a link in rich text keeps its words and its address as text, never as a link', async () => {
  const { t, ir, record } = await hostile06();
  const views = [
    {
      name: ir.views[0]!.name,
      caption: 'V',
      prepared: await prepareView(t, ir, { view: ir.views[0]!.name }),
    },
  ];
  const a = (await archiveRecords(t, ir, [record], { views, now: NOW, fileName: 'f.xsn' }))!;
  const page = (await unzip(a.bytes)).get(record.fileName.replace(/\.xml$/, '.html'))!;
  expect(page).not.toContain('href="http://evil.example');
  expect(page).toMatch(
    /out link<\/span> <span class="afl-archive-url">\(http:\/\/evil\.example\/out\)<\/span>/,
  );
});

test('A3: index cells with long text get a readable width', async () => {
  const { t, ir } = await open('05-new-hire-onboarding');
  const v = ir.views[0]!;
  const views = [
    { name: v.name, caption: 'V', prepared: await prepareView(t, ir, { view: v.name }) },
  ];
  const a = (await archiveRecords(t, ir, recordsOf('05-new-hire-onboarding').slice(0, 2), {
    views,
    now: NOW,
    fileName: 'f.xsn',
  }))!;
  const index = (await unzip(a.bytes)).get('index.html')!;
  expect(index).toMatch(/<td class="long">Welcome/);
  expect(index).toMatch(/td\.long \{ min-width: 24em/);
});

test('R3, A4: Failed checks is beside the file name, and a clean record says None', async () => {
  const { t, ir } = await open('02-expense-report');
  const list = recordList(t, ir, recordsOf('02-expense-report'), NOW);
  expect(list.columns.slice(0, 3).map((c) => c.label)).toEqual([
    'File name',
    'Failed checks',
    'Template version',
  ]);
  expect(list.rows[0]!.cells[1]).toBe('None');
  expect(list.rows[0]!.keys[1]).toBe(0);
});

test('R2: every value of a record is searchable, repeating rows too, with where it is', async () => {
  const { t, ir } = await open('02-expense-report');
  const list = recordList(t, ir, recordsOf('02-expense-report'), NOW);
  expect(list.rows[0]!.more).toContainEqual('Type: Lodging');
});

test('F1: a dropdown shows the name the form shows, not its stored value', async () => {
  const { t, ir } = await open('02-expense-report');
  const list = recordList(t, ir, recordsOf('02-expense-report'), NOW);
  const dept = list.columns.findIndex((c) => c.label === 'Department');
  expect(list.rows[0]!.cells[dept]).toBe('Sales');
});

test('P3: Markdown: no bare domain or e-mail outside code, no indented code block, no escape mid-line', () => {
  expect(mdText('calls forms-legacy.contoso-fictional.example now')).toBe(
    'calls `forms-legacy.contoso-fictional.example` now',
  );
  expect(mdText('    four spaces')).toBe('four spaces');
  expect(mdText('Version 1.0.0.1')).toBe('Version 1.0.0.1');
  expect(mdText('1.0.0.1')).toBe('1.0.0.1');
  expect(mdText('1. starts a list')).toBe('1\\. starts a list');
});

test('P4: what could not be read is said in words; the path goes under the sentence', async () => {
  const { ir } = await open('04-purchase-request');
  const hurt: FormIR = {
    ...ir,
    issues: [
      {
        code: 'DUPLICATE_ID',
        message: 'id f:main:/my:a is used 2 times; this one is f:main:/my:a#2',
        file: 'manifest.xsf',
        path: '/xsf:xDocumentClass/xsf:views[1]',
        line: 7,
        details: { id: 'f:main:/my:a', assigned: 'f:main:/my:a#2' },
      },
      {
        code: 'UNRESOLVED_REFERENCE',
        message: 'x in r1 (condition) not resolved: y',
        details: { kind: 'expression' },
      },
    ],
  };
  const d = buildDossier(hurt, { fileName: 'f.xsn', records: 0 });
  expect(d.unread).toHaveLength(1);
  expect(d.unread[0]!.sentence).toBe(
    'Two parts of the template have the same name, so the second is listed under another name (manifest.xsf, line 7).',
  );
  expect(d.unread[0]!.sentence).not.toMatch(/\/|f:main/);
  expect(d.unread[0]!.expressions).toEqual(['/xsf:xDocumentClass/xsf:views[1]', 'f:main:/my:a']);
  expect(dossierMarkdown(d)).toContain('Two parts of the template');
});
