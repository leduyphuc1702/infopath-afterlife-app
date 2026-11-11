// Spec 18: the records of one form as a folder of web pages, zipped. Each page is a record's view
// as the paper draws it in read mode, with its styles inside, no script and a content security
// policy that allows only inline styles and `data:` images (R6). Pure: bytes in, bytes out.
import type { FormIR } from '../ir/types';
import type { PreparedView } from '../render/prepare';
import { renderView } from '../render/render';
import type { ParsedTemplate } from '../xsn/parse';
import { writeZip, type ZipInput } from '../zip/write';
import { safeSegment } from './attachment';
import { recordList } from './list';
import { recordTables, type RecordFile } from './tables';

export interface ArchiveView {
  readonly name: string;
  readonly caption: string;
  readonly prepared: PreparedView;
}

export interface ArchiveOptions {
  readonly views: readonly ArchiveView[];
  /** Render time, and the archive time in each page's foot: local time with its offset. */
  readonly now: string;
  /** The template's file name. */
  readonly fileName: string;
  /** The page's own read-mode rules, after the view's. */
  readonly css?: string;
  /** Zip entry times; default 1980-01-01 (deterministic). */
  readonly date?: Date;
  readonly progress?: (index: number, total: number, fileName: string) => void;
  /** Polled before each record; true stops the archive, which then gives `undefined`. */
  readonly cancelled?: () => boolean;
}

export interface RecordArchive {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly records: number;
  readonly pages: number;
  readonly files: number;
  /** Records that could not be read or drawn; each still has its page (R9). */
  readonly unread: number;
}

export const ARCHIVE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

const ARCHIVE_CSS = `
body { margin: 0; font-family: Calibri, Carlito, sans-serif; color: #172b4d; background: #fff; }
.afl-archive-nav, .afl-archive-foot { font: 14px/1.5 system-ui, sans-serif; padding: 8px 16px; }
.afl-archive-nav { border-bottom: 1px solid #dfe1e6; display: flex; gap: 16px; flex-wrap: wrap; }
.afl-archive-foot { border-top: 1px solid #dfe1e6; margin-top: 16px; }
.afl-archive-page { padding: 16px; overflow-x: auto; }
.afl-root input, .afl-root select, .afl-root textarea, .afl-root button { pointer-events: none; }
.afl-root input[type='button'] { opacity: 0.5; filter: grayscale(1); }
/* Nothing can be inserted in an archive. */
.afl-root [data-afl-structure='insert'] { display: none !important; }
.afl-archive-error { color: #ae2e24; }
@media print { .afl-archive-nav { display: none; } }
`;

const INDEX_CSS = `
body { font: 14px/1.5 system-ui, sans-serif; color: #172b4d; margin: 16px; }
table { border-collapse: collapse; }
th, td { border: 1px solid #dfe1e6; padding: 2px 8px; text-align: left; vertical-align: top; }
thead th { background: #f4f5f7; }
td.n { text-align: right; }
tbody th { white-space: nowrap; }
`;

const enc = new TextEncoder();
const esc = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
/** A relative link to an entry: each segment encoded, so it can never be a scheme or leave. */
const href = (path: string) => esc(path.split('/').map(encodeURIComponent).join('/'));

const head = (title: string, css: string) =>
  '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
  `<meta http-equiv="Content-Security-Policy" content="${ARCHIVE_CSP}">` +
  '<meta name="referrer" content="no-referrer">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  `<title>${esc(title)}</title><style>${css}</style></head><body>`;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function archiveRecords(
  t: ParsedTemplate,
  ir: FormIR,
  records: readonly RecordFile[],
  options: ArchiveOptions,
): Promise<RecordArchive | undefined> {
  const { views, now } = options;
  const form = ir.meta.name;
  const version = ir.meta.solutionVersion ?? 'not given';
  const tables = recordTables(ir, records);
  const list = recordList(t, ir, records, now);
  const unreadNames = new Set(tables.unread.map((u) => u.fileName));
  const zone = /([+-]\d\d:\d\d|Z)$/.exec(now)?.[1];
  const when = `${now.slice(0, 16).replace('T', ' ')}${zone ? ` (UTC${zone === 'Z' ? '' : zone})` : ''}`;

  // Page names, unique ignoring case, as the export names attachment files.
  const used = new Set<string>();
  const unique = (name: string) => {
    let n = name;
    for (let i = 2; used.has(n.toLowerCase()); i++) n = name.replace(/\.html$/, ` (${i}).html`);
    used.add(n.toLowerCase());
    return n;
  };
  used.add('index.html');
  const pageNames = records.map((r) => {
    const base = safeSegment(r.fileName.replace(/\.xml$/i, ''), 80);
    return views.map((v) =>
      unique(views.length === 1 ? `${base}.html` : `${base} - ${safeSegment(v.caption, 40)}.html`),
    );
  });

  const entries: ZipInput[] = [];
  const unread = new Set<number>();
  let yielded = Date.now();
  for (const [i, record] of records.entries()) {
    if (options.cancelled?.()) return undefined;
    options.progress?.(i + 1, records.length, record.fileName);
    if (Date.now() - yielded > 50) {
      await tick();
      yielded = Date.now();
      if (options.cancelled?.()) return undefined;
    }
    if (unreadNames.has(record.fileName)) unread.add(i);
    const base = safeSegment(record.fileName.replace(/\.xml$/i, ''));
    const files = tables.files.filter((f) => f.path.startsWith(`attachments/${base}/`));
    for (const [k, v] of views.entries()) {
      let body: string;
      let css = '';
      try {
        const r = renderView(v.prepared, { now, locale: 'en-US', record: record.bytes });
        css = r.css;
        // Searchable and selectable: the archive's own rule keeps the controls still.
        body = r.html.replace(/^(<div\b[^>]*?)\sinert(="")?(?=[\s>])/, '$1');
      } catch (e) {
        unread.add(i);
        body = `<p class="afl-archive-error">This view could not be drawn from the record: ${esc(message(e))}</p>`;
      }
      const nav = [
        '<a href="index.html">All records</a>',
        ...views.map((w, j) =>
          j === k
            ? `<span aria-current="page">${esc(w.caption)}</span>`
            : `<a href="${href(pageNames[i]![j]!)}">${esc(w.caption)}</a>`,
        ),
      ];
      const attached = files.length
        ? `<p>Files in this record: ${files
            .map(
              (f) =>
                `<a href="${href(f.path)}">${esc(f.path.slice(f.path.lastIndexOf('/') + 1))}</a>`,
            )
            .join(', ')}.</p>`
        : '';
      const html =
        head(
          `${record.fileName} · ${v.caption} · ${form}`,
          `${css}${options.css ?? ''}${ARCHIVE_CSS}`,
        ) +
        `<nav class="afl-archive-nav" aria-label="Archive">${nav.join('')}</nav>` +
        `<main class="afl-archive-page">${body}</main>` +
        `<footer class="afl-archive-foot">${attached}<p>Record file ${esc(record.fileName)}, view “${esc(v.caption)}”, ` +
        `of the form “${esc(form)}”, version ${esc(version)} (${esc(options.fileName)}). ` +
        `Archived on ${esc(when)} with InfoPath Afterlife.</p></footer></body></html>\n`;
      entries.push({ name: pageNames[i]![k]!, bytes: enc.encode(html) });
    }
  }

  // R5: the index, with the records list's columns.
  const head1 = list.columns.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('');
  const rows = list.rows.map((r, i) => {
    const cells = r.cells.map((c, j) =>
      j === 0
        ? `<th scope="row"><a href="${href(pageNames[i]![0]!)}">${esc(c)}</a>${unread.has(i) ? ' (could not be read)' : ''}</th>`
        : `<td${list.columns[j]!.kind === 'text' ? '' : ' class="n"'}>${esc(c)}</td>`,
    );
    return `<tr>${cells.join('')}</tr>`;
  });
  const index =
    head(`Records of ${form}`, INDEX_CSS) +
    `<h1>${esc(form)}: ${records.length} ${records.length === 1 ? 'record' : 'records'}</h1>` +
    `<p>Version ${esc(version)} (${esc(options.fileName)}). Archived on ${esc(when)} with InfoPath Afterlife. ` +
    `Each file name opens the record as the form showed it${views.length > 1 ? `; each page links to its other views` : ''}.</p>` +
    `<table><thead><tr>${head1}</tr></thead><tbody>${rows.join('')}</tbody></table></body></html>\n`;

  const readme = [
    `Records of the form "${form}", version ${version} (${options.fileName}).`,
    '',
    `This folder holds ${records.length} filled-in ${records.length === 1 ? 'record' : 'records'} as web pages, one page per record and view, as the form showed them.`,
    'Open index.html in any web browser to see the list of records. Nothing else is needed: no InfoPath, no internet connection, no program from us.',
    'The pages hold no script and load nothing from the network. Attachments and pictures in the records are in the attachments folder, linked from each page.',
    '',
    `Archived on ${when} with InfoPath Afterlife, from the original record files.`,
    '',
  ].join('\r\n');

  entries.unshift(
    { name: 'index.html', bytes: enc.encode(index) },
    { name: 'README.txt', bytes: enc.encode(readme) },
  );
  for (const f of tables.files) entries.push({ name: f.path, bytes: f.bytes });
  return {
    bytes: await writeZip(entries, options.date === undefined ? {} : { date: options.date }),
    records: records.length,
    pages: records.length * views.length,
    files: tables.files.length,
    unread: unread.size,
  };
}
