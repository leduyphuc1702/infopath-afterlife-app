import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { expect, test } from 'vitest';
import {
  ARCHIVE_CSP,
  archiveRecords,
  buildFormIR,
  parseXsn,
  prepareView,
  readZip,
  recordTables,
  type RecordFile,
} from '../../src/index';
import { recordsOf } from './records';

// Spec 18: records as web pages.
const OWN = new URL('../../../../samples/own/', import.meta.url);
const NOW = '2026-11-11T14:45:00+07:00';
const dec = new TextDecoder();
const unzip = async (bytes: Uint8Array) =>
  Promise.all(
    readZip(bytes)
      .filter((e) => !e.directory)
      .map(async (e) => ({ name: e.name, bytes: await e.read() })),
  );

async function setup(slug: string) {
  const t = await parseXsn(readFileSync(new URL(`xsn/${slug}.xsn`, OWN)));
  const ir = buildFormIR(t);
  const views = await Promise.all(
    ir.views.map(async (v) => ({
      name: v.name,
      caption: v.caption ?? v.name,
      prepared: await prepareView(t, ir, { view: v.name }),
    })),
  );
  return { t, ir, views };
}
async function archive(slug: string, records: readonly RecordFile[], viewCount?: number) {
  const { t, ir, views } = await setup(slug);
  const a = await archiveRecords(t, ir, records, {
    views: views.slice(0, viewCount),
    now: NOW,
    fileName: `${slug}.xsn`,
  });
  const entries = await unzip(a!.bytes);
  return { a: a!, ir, entries: new Map(entries.map((e) => [e.name, e.bytes])) };
}

test('R2–R5, R7: form 02, 30 records: pages, index, readme, attachments named as the export', async () => {
  const recs = recordsOf('02-expense-report');
  const t0 = performance.now();
  const { a, ir, entries } = await archive('02-expense-report', recs);
  console.log(
    `R2 form 02: ${a.pages} pages, ${a.files} files, ${a.bytes.byteLength} bytes in ${Math.round(performance.now() - t0)} ms`,
  );
  expect([a.records, a.pages, a.unread]).toEqual([30, 30, 0]);
  const files = recordTables(ir, recs).files.map((f) => f.path);
  expect(a.files).toBe(files.length);
  for (const f of files) expect(entries.has(f), f).toBe(true);
  expect(entries.has('index.html') && entries.has('README.txt')).toBe(true);
  const page = dec.decode(entries.get('02-expense-report-001.html'));
  expect(page).toContain(`<meta http-equiv="Content-Security-Policy" content="${ARCHIVE_CSP}">`);
  expect(page).toContain('Kenji Brask');
  expect(page).toContain('<a href="index.html">All records</a>');
  expect(page).toMatch(
    /Record file 02-expense-report-001\.xml, view “[^”]+”, of the form “Expense Report”, version 1\.0\.0\.1 \(02-expense-report\.xsn\)\. Archived on 2026-11-11 14:45 \(UTC\+07:00\)/,
  );
  expect(page).not.toMatch(/<div class="afl-root"[^>]*\sinert/);
  const own = files.filter((f) => f.startsWith('attachments/02-expense-report-001/'));
  for (const f of own)
    expect(page).toContain(`href="${f.split('/').map(encodeURIComponent).join('/')}"`);
  const index = dec.decode(entries.get('index.html'));
  expect(index.match(/<tr>/g)).toHaveLength(31);
  expect(index).toContain('<a href="02-expense-report-001.html">02-expense-report-001.xml</a>');
  expect(index).toContain('<th scope="col">Failed checks</th>');
  expect(dec.decode(entries.get('README.txt'))).toContain('Nothing else is needed');
});

test('R4: two or more views: a page per view, each linking to the others; an order is kept', async () => {
  const recs = recordsOf('05-new-hire-onboarding').slice(0, 2).reverse();
  const { a, entries } = await archive('05-new-hire-onboarding', recs);
  expect(a.pages).toBeGreaterThan(2);
  const pages = [...entries.keys()].filter((n) => n.endsWith('.html') && n !== 'index.html');
  expect(pages).toHaveLength(a.pages);
  const first = dec.decode(entries.get(pages[0]!));
  for (const p of pages.filter((p) => p.startsWith(pages[0]!.split(' - ')[0]!)).slice(1))
    expect(first).toContain(`href="${encodeURIComponent(p)}"`);
  const index = dec.decode(entries.get('index.html'));
  expect(index.indexOf(recs[0]!.fileName)).toBeLessThan(index.indexOf(recs[1]!.fileName));
});

test('R8, R9: cancel gives nothing; a record that cannot be read still has its page', async () => {
  const { t, ir, views } = await setup('02-expense-report');
  const recs = recordsOf('02-expense-report');
  let seen = 0;
  const none = await archiveRecords(t, ir, recs, {
    views,
    now: NOW,
    fileName: 'x.xsn',
    progress: (i) => (seen = i),
    cancelled: () => seen >= 3,
  });
  expect([none, seen]).toEqual([undefined, 3]);
  const bad = { fileName: 'broken.xml', bytes: new TextEncoder().encode('<not closed') };
  const a = (await archiveRecords(t, ir, [bad], { views, now: NOW, fileName: 'x.xsn' }))!;
  expect(a.unread).toBe(1);
  const entries = new Map((await unzip(a.bytes)).map((e) => [e.name, e.bytes]));
  expect(dec.decode(entries.get('broken.html'))).toContain('could not be drawn');
});

// --- P21 --------------------------------------------------------------------------------------

const HOSTILE = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "javascript:alert('x')",
  '</style><script>x()</script>',
  'onload=alert(1)',
  '<a href="https://evil.example/">x</a>',
  "' onmouseover='x",
  '<meta http-equiv="refresh" content="0;url=https://evil.example">',
  '\u0000\u0007\u202e',
  'url(https://evil.example/x.png)',
  '<base href="https://evil.example/">',
  '&lt;iframe src=//evil.example&gt;',
  '<!--',
  ']]>',
];
const xmlText = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/** R6: what a page must not hold, with the names of the archive's own entries. */
function leaks(html: string, names: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join('\n');
  const markup = html.replace(/<style>[\s\S]*?<\/style>/g, '<style></style>');
  if ((html.match(/<style>/g) ?? []).length !== (html.match(/<\/style>/g) ?? []).length)
    out.push('style break');
  if (/<\/?(script|base|iframe|object|embed|link|frame|svg|math)\b/i.test(markup))
    out.push('element');
  if (/<meta[^>]*http-equiv\s*=\s*"?refresh/i.test(markup)) out.push('refresh');
  for (const tag of markup.matchAll(/<[a-z][^>]*>/gi)) {
    for (const a of tag[0].matchAll(/\s([a-z-:]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)) {
      const name = a[1]!.toLowerCase();
      const value = a[2]!
        .replace(/^["']|["']$/g, '')
        .replace(/&(#\d+|quot|lt|gt|amp);/g, (_m, e: string) =>
          e[0] === '#'
            ? String.fromCharCode(Number(e.slice(1)))
            : ({ quot: '"', lt: '<', gt: '>', amp: '&' } as Record<string, string>)[e]!,
        );
      if (/^on/.test(name)) out.push(`handler ${name}`);
      if (
        ['href', 'src', 'action', 'formaction', 'srcset', 'poster', 'data', 'xlink:href'].includes(
          name,
        )
      ) {
        if (/^data:image\/(png|gif|jpeg|bmp);base64,/i.test(value)) continue;
        if (/^[a-z][a-z0-9+.-]*:|^\/|\\/i.test(value)) {
          out.push(`url ${value}`);
          continue;
        }
        const target = decodeURIComponent(value.split('#')[0]!);
        if (target !== '' && !names.has(target)) out.push(`missing ${target}`);
      }
    }
  }
  for (const u of css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi))
    if (!/^data:image\/(png|gif|jpeg|bmp);base64,/i.test(u[2]!)) out.push(`css url ${u[2]}`);
  if (/@import/i.test(css)) out.push('@import');
  return out;
}

test('P21: an archive of hostile records holds no script, no handler, no URL that leaves it', async () => {
  const { t, ir, views } = await setup('02-expense-report');
  const base = dec.decode(recordsOf('02-expense-report')[0]!.bytes);
  const value = fc.oneof(fc.constantFrom(...HOSTILE), fc.string({ maxLength: 12 }));
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({ name: value, purpose: value, description: value, file: value }), {
        minLength: 1,
        maxLength: 3,
      }),
      async (rs) => {
        const records = rs.map((r, i) => ({
          fileName: `${r.file}-${i}.xml`,
          bytes: new TextEncoder().encode(
            base
              .replace(/<my:claimantName>[^<]*</, `<my:claimantName>${xmlText(r.name)}<`)
              .replace(/<my:businessPurpose>[^<]*</, `<my:businessPurpose>${xmlText(r.purpose)}<`)
              .replace(
                /<my:expenseDescription>[^<]*</,
                `<my:expenseDescription>${xmlText(r.description)}<`,
              ),
          ),
        }));
        const a = (await archiveRecords(t, ir, records, {
          views,
          now: NOW,
          fileName: `${rs[0]!.file}.xsn`,
        }))!;
        const entries = await unzip(a.bytes);
        const names = new Set(entries.map((e) => e.name));
        for (const e of entries.filter((x) => x.name.endsWith('.html'))) {
          const html = dec.decode(e.bytes);
          expect(html, e.name).toContain(ARCHIVE_CSP);
          expect(leaks(html, names), e.name).toEqual([]);
        }
      },
    ),
    { numRuns: 100 },
  );
});

test('P21 on every own form with records: no page leaks', async () => {
  for (const slug of [
    '01-leave-request',
    '03-travel-request',
    '06-safety-incident',
    '08-big-form',
  ]) {
    const recs = recordsOf(slug).slice(0, 3);
    if (recs.length === 0) continue;
    const { entries } = await archive(slug, recs);
    const names = new Set(entries.keys());
    for (const [n, b] of entries)
      if (n.endsWith('.html')) expect(leaks(dec.decode(b), names), `${slug} ${n}`).toEqual([]);
  }
});

test('P21’s checker finds each kind of leak', () => {
  const names = new Set(['index.html']);
  for (const bad of [
    '<script>x</script>',
    '<img src="https://e.example/x.png">',
    '<p onclick="x">',
    '<a href="javascript:x">',
    '<a href="other.html">',
    '<style>p{background:url(https://e.example)}</style>',
    '<base href="/">',
    '<meta http-equiv="refresh" content="0">',
    '<a href="//e.example">',
  ])
    expect(leaks(bad, names), bad).not.toEqual([]);
  expect(leaks('<a href="index.html">ok</a><img src="data:image/png;base64,AA==">', names)).toEqual(
    [],
  );
});
