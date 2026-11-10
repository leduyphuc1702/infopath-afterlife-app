// Spec 12 R5.1, design §5, D8: the plan as CSV. RFC 4180 (CRLF, quotes doubled), UTF-8 text; the
// page adds nothing but the download. A cell starting with `=`, `+`, `-`, `@`, a tab or a
// carriage return is prefixed with `'`, so a spreadsheet does not read it as a formula (OWASP
// "CSV Injection"; `Changed at review (2026-11-11):` tab and carriage return added).
import { CLASS_WORDS } from '../coverage/table';
import type { TriageResult } from './triage';

export const CSV_COLUMNS = [
  'File',
  'Name',
  'URN',
  'Generation',
  'Browser compatible',
  'Fields',
  'Repeating groups',
  'Views',
  'Rules',
  'Data connections',
  CLASS_WORDS.native.ui,
  CLASS_WORDS.emulated.ui,
  CLASS_WORDS.manual.ui,
  CLASS_WORDS.unsupported.ui,
  'Native %',
  'Records',
  'Wave',
  'Causes',
  'Error',
] as const;

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | boolean | undefined): string {
  let s =
    value === undefined ? '' : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(result: TriageResult): string {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const r of result.rows) {
    const cells =
      r.kind === 'error'
        ? [r.fileName, ...Array<undefined>(CSV_COLUMNS.length - 2).fill(undefined), r.code]
        : [
            r.fileName,
            r.name,
            r.urn,
            r.generation,
            r.browserCompatible,
            r.counts.fields,
            r.counts.repeatingGroups,
            r.counts.views,
            r.counts.rules,
            r.counts.connections,
            r.coverage.native,
            r.coverage.emulated,
            r.coverage.manual,
            r.coverage.unsupported,
            r.nativePercent,
            r.records,
            r.wave,
            r.causes.map((c) => c.id).join(' '),
            undefined,
          ];
    lines.push(cells.map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
