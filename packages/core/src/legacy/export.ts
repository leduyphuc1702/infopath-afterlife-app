// Spec 09 R12.1–R12.4, design §11: the record tables as an Excel workbook (`.xlsx`) or as a
// `.zip` of CSV files with the extracted attachments. Pure: bytes in, bytes out.
import { csvCell } from '../triage/csv';
import { writeZip, type ZipInput } from '../zip/write';
import type { FormIR } from '../ir/types';
import { recordTables, type Cell, type RecordFile, type RecordTables, type Sheet } from './tables';

export type ExportFormat = 'xlsx' | 'csv';

export interface ExportOptions {
  readonly format: ExportFormat;
  /** The files' time in the archive; default 1980-01-01 (deterministic). */
  readonly date?: Date;
  /** Called before each record is read, 1-based. */
  readonly progress?: (index: number, total: number, fileName: string) => void;
}

export interface RecordExport {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly records: number;
  readonly files: number;
  readonly unread: RecordTables['unread'];
}

/** Excel's limit on the characters of one cell. */
const XLSX_CELL_MAX = 32_767;
export const ATTACHMENT_NOTE =
  'Attachment and picture cells give a path. The files themselves are in the CSV export (.zip).';

const enc = new TextEncoder();
const textOf = (c: Cell) => (typeof c === 'string' ? c : c.number);

/** RFC 4180 with core's formula guard (`csvCell`); a number cell is written as InfoPath wrote it. */
export function sheetCsv(sheet: Sheet): string {
  const line = (cells: readonly Cell[]) =>
    cells.map((c) => (typeof c === 'string' ? csvCell(c) : c.number)).join(',');
  return [sheet.columns.map(csvCell).join(','), ...sheet.rows.map(line)].join('\r\n') + '\r\n';
}

// eslint-disable-next-line no-control-regex
const NOT_XML = /[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu;
const xml = (s: string) =>
  s
    .replace(NOT_XML, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function columnName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** The parts of a minimal workbook: every cell written, empty ones too; strings shared. */
export function xlsxParts(sheets: readonly Sheet[]): ZipInput[] {
  const strings: string[] = [];
  const index = new Map<string, number>();
  const shared = (s: string) => {
    let i = index.get(s);
    if (i === undefined) {
      i = strings.length;
      strings.push(s);
      index.set(s, i);
    }
    return i;
  };
  const sheetXml = (s: Sheet) => {
    const rows = [s.columns as readonly Cell[], ...s.rows].map((cells, r) => {
      const cs = cells.map((c, i) => {
        const ref = `${columnName(i)}${r + 1}`;
        if (typeof c !== 'string') return `<c r="${ref}"><v>${c.number}</v></c>`;
        if (c === '') return `<c r="${ref}"/>`;
        return `<c r="${ref}" t="s"><v>${shared(c.slice(0, XLSX_CELL_MAX))}</v></c>`;
      });
      return `<row r="${r + 1}">${cs.join('')}</row>`;
    });
    return `${HEAD}<worksheet xmlns="${NS}"><sheetData>${rows.join('')}</sheetData></worksheet>`;
  };
  const worksheets = sheets.map((s, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    bytes: enc.encode(sheetXml(s)),
  }));
  const ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
  return [
    {
      name: '[Content_Types].xml',
      bytes: enc.encode(
        `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          `<Override PartName="/xl/workbook.xml" ContentType="${ct}.sheet.main+xml"/>` +
          sheets
            .map(
              (_s, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${ct}.worksheet+xml"/>`,
            )
            .join('') +
          `<Override PartName="/xl/sharedStrings.xml" ContentType="${ct}.sharedStrings+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="${ct}.styles+xml"/></Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      bytes: enc.encode(
        `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      bytes: enc.encode(
        `${HEAD}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>` +
          sheets
            .map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
            .join('') +
          '</sheets></workbook>',
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      bytes: enc.encode(
        `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          sheets
            .map(
              (_s, i) =>
                `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join('') +
          `<Relationship Id="rId${sheets.length + 1}" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>` +
          `<Relationship Id="rId${sheets.length + 2}" Type="${REL}/styles" Target="styles.xml"/>` +
          '</Relationships>',
      ),
    },
    ...worksheets,
    {
      name: 'xl/sharedStrings.xml',
      bytes: enc.encode(
        `${HEAD}<sst xmlns="${NS}" count="${strings.length}" uniqueCount="${strings.length}">` +
          strings.map((s) => `<si><t xml:space="preserve">${xml(s)}</t></si>`).join('') +
          '</sst>',
      ),
    },
    {
      name: 'xl/styles.xml',
      bytes: enc.encode(
        `${HEAD}<styleSheet xmlns="${NS}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
          '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
          '</styleSheet>',
      ),
    },
  ];
}

/** Spec 09 R12.1–R12.3: the open template's records, as a workbook or a zip of CSVs. */
export async function exportRecords(
  ir: FormIR,
  records: readonly RecordFile[],
  options: ExportOptions,
): Promise<RecordExport> {
  const t = recordTables(ir, records, options.progress);
  const unreadColumn = t.unread.length > 0;
  const sheets = t.sheets.map((s, i) => {
    if (i !== 0 || !unreadColumn) return s;
    const why = new Map(t.unread.map((u) => [u.fileName, u.reason]));
    return {
      ...s,
      columns: [...s.columns, 'Read error'],
      rows: s.rows.map((r) => [...r, why.get(textOf(r[0]!)) ?? '']),
    };
  });
  const date = options.date === undefined ? {} : { date: options.date };
  const entries: ZipInput[] =
    options.format === 'xlsx'
      ? xlsxParts(
          t.files.length === 0
            ? sheets
            : [...sheets, { name: 'About', columns: ['Note'], rows: [[ATTACHMENT_NOTE]] }],
        )
      : [
          ...sheets.map((s) => ({
            name: `${s.name}.csv`,
            bytes: enc.encode(`\ufeff${sheetCsv(s)}`),
          })),
          ...t.files.map((f) => ({ name: f.path, bytes: f.bytes })),
        ];
  return {
    bytes: await writeZip(entries, date),
    records: records.length,
    files: t.files.length,
    unread: t.unread,
  };
}
