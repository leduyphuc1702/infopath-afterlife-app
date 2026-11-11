// Spec 17: the records of one form as a list to find, sort and open. The columns are the
// export's Records sheet (spec 09 R12), so the screen and the workbook never disagree, plus one
// count per repeating group or field outside other repeating ones, and the failed checks Fill
// shows. Values are shown as the form's views format them; each has a key to sort by.
import { buttonDecode, xslAttr } from '../dossier/buttons';
import type { FormIR, IrField, IrGroup } from '../ir/types';
import { FillSession } from '../runtime/session';
import { formatString } from '../xpath-fns/format';
import type { ParsedTemplate } from '../xsn/parse';
import { recordTables, type Cell, type RecordFile } from './tables';

const cellText = (c: Cell | undefined) =>
  c === undefined ? '' : typeof c === 'string' ? c : c.number;

export type ListKind = 'text' | 'number' | 'date' | 'count' | 'checks';

export interface ListColumn {
  readonly label: string;
  /** The Records sheet's header (the field path), for fields. */
  readonly path?: string;
  readonly kind: ListKind;
}

/** A sort key: a number, an ISO date or text; `null` when empty. */
export type ListKey = number | string | null;

export interface ListRow {
  readonly fileName: string;
  readonly cells: readonly string[];
  readonly keys: readonly ListKey[];
  /** Spec 19 R2: the values in repeating rows, as "Label: value", for Find. */
  readonly more: readonly string[];
}

export interface RecordList {
  readonly columns: readonly ListColumn[];
  readonly rows: readonly ListRow[];
}

export interface ViewFormat {
  readonly type: string;
  readonly options: string;
}

/** R3: the `xd:datafmt` of each bound control, by the local name of the binding's last step. */
export function viewFormats(t: ParsedTemplate): Map<string, ViewFormat> {
  const out = new Map<string, ViewFormat>();
  for (const f of t.files) {
    if (!f.name.toLowerCase().endsWith('.xsl')) continue;
    const text = new TextDecoder().decode(f.bytes);
    for (const m of text.matchAll(/<[a-z][^>]*\sxd:datafmt\s*=[^>]*>/gi)) {
      const binding = xslAttr(m[0], 'xd:binding');
      const fmt = xslAttr(m[0], 'xd:datafmt');
      if (binding === undefined || fmt === undefined) continue;
      const p = /^"([^"]*)","([^"]*)"$/.exec(buttonDecode(fmt).trim());
      const step = binding.slice(binding.lastIndexOf('/') + 1).replace(/^@/, '');
      const name = step.slice(step.indexOf(':') + 1);
      if (p && !out.has(name)) out.set(name, { type: p[1]!, options: p[2]! });
    }
  }
  return out;
}

/**
 * Spec 19 F1: the names a view's dropdowns and list boxes show for their stored values, by the
 * local name of the binding's last step; first one wins. Only static options are read.
 */
export function viewChoices(t: ParsedTemplate): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const f of t.files) {
    if (!f.name.toLowerCase().endsWith('.xsl')) continue;
    const text = new TextDecoder().decode(f.bytes);
    for (const m of text.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
      const binding = xslAttr(m[0].slice(0, m[0].indexOf('>') + 1), 'xd:binding');
      if (binding === undefined) continue;
      const step = binding.slice(binding.lastIndexOf('/') + 1).replace(/^@/, '');
      const name = step.slice(step.indexOf(':') + 1);
      if (out.has(name)) continue;
      const map = new Map<string, string>();
      for (const o of m[0].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
        const value = xslAttr(`<option${o[1]}>`, 'value');
        const label = buttonDecode(
          o[2]!.replace(/<xsl:if\b[\s\S]*?<\/xsl:if>/g, '').replace(/<[^>]*>/g, ''),
        ).trim();
        if (
          value !== undefined &&
          !value.includes('{') &&
          label !== '' &&
          !map.has(buttonDecode(value))
        )
          map.set(buttonDecode(value), label);
      }
      if (map.size) out.set(name, map);
    }
  }
  return out;
}

const NUMERIC =
  /^xsd:(decimal|double|float|(non)?(negative|positive)?integer|nonNegativeInteger|positiveInteger|negativeInteger|nonPositiveInteger|int|long|short|byte|unsigned\w+)$/i;
const kindOf = (f: IrField | undefined): ListKind => {
  const b = f?.xsdType.builtin ?? '';
  return NUMERIC.test(b) ? 'number' : b === 'xsd:date' || b === 'xsd:dateTime' ? 'date' : 'text';
};

export function recordList(
  t: ParsedTemplate,
  ir: FormIR,
  records: readonly RecordFile[],
  now: string,
): RecordList {
  const tables = recordTables(ir, records);
  const [main, ...subs] = tables.sheets;
  const fields = new Map<string, IrField>();
  for (const f of ir.fields)
    if (f.dataSource === 'main' && !fields.has(f.path)) fields.set(f.path, f);
  const formats = viewFormats(t);
  const choices = viewChoices(t);
  const localOf = (f: IrField) => f.name.slice(f.name.indexOf(':') + 1);

  // The sheets after Records follow the repeating nodes in depth-first order (as recordTables).
  type Node = IrField | IrGroup;
  const nodes: Node[] = [...ir.groups, ...ir.fields].filter((n) => n.dataSource === 'main');
  const children = new Map<string | undefined, Node[]>();
  for (const n of nodes) children.set(n.groupId, [...(children.get(n.groupId) ?? []), n]);
  const repeating: { node: Node; top: boolean }[] = [];
  const walk = (g: IrGroup, nested: boolean) => {
    for (const c of children.get(g.id) ?? []) {
      if (c.repeating) repeating.push({ node: c, top: !nested });
      if (c.kind === 'group') walk(c, nested || c.repeating);
    }
  };
  const root = (children.get(undefined) ?? []).find((n): n is IrGroup => n.kind === 'group');
  if (root) walk(root, false);

  const fieldColumns = (main?.columns ?? []).map((path, i): ListColumn & { field?: IrField } => {
    if (i === 0) return { label: 'File name', kind: 'text' };
    if (i === 1) return { label: 'Template version', kind: 'text' };
    const f = fields.get(path);
    return { label: f?.label || path, path, kind: kindOf(f), ...(f && { field: f }) };
  });
  const counts = subs.flatMap((s, i) => {
    const r = repeating[i];
    if (!r?.top) return [];
    const per = new Map<string, number>();
    for (const row of s.rows) per.set(cellText(row[0]), (per.get(cellText(row[0])) ?? 0) + 1);
    return [{ label: `${r.node.label || r.node.name} (rows)`, per }];
  });

  /** One value as the form shows it, and its sort key. */
  const shown = (kind: ListKind, field: IrField | undefined, raw: string): [string, ListKey] => {
    const text = raw.trim();
    if (text === '') return [raw.replace(/^\s+$/, ''), null];
    const fmt = field && formats.get(localOf(field));
    if (kind === 'number') {
      const v = Number(text);
      return [
        fmt ? formatString(text, fmt.type, fmt.options) : text,
        Number.isFinite(v) ? v : text,
      ];
    }
    if (kind === 'date') return [fmt ? formatString(text, fmt.type, fmt.options) : text, text];
    if (field?.xsdType.builtin === 'xsd:boolean' && (raw === 'TRUE' || raw === 'FALSE'))
      return raw === 'TRUE' ? ['Yes', 'Yes'] : ['No', 'No'];
    const label = field && choices.get(localOf(field))?.get(raw);
    return label === undefined ? [raw, raw] : [label, label];
  };
  // R2: the repeating sheets' values, per record file.
  const moreOf = new Map<string, string[]>();
  for (const sheet of subs) {
    const fixed = sheet.columns.findIndex((c) => fields.has(c));
    for (const row of sheet.rows) {
      const file = cellText(row[0]);
      const list = moreOf.get(file) ?? [];
      for (let i = fixed < 0 ? sheet.columns.length : fixed; i < sheet.columns.length; i++) {
        const f = fields.get(sheet.columns[i]!);
        const [cell] = shown(kindOf(f), f, cellText(row[i]));
        if (cell !== '') list.push(`${f?.label || sheet.columns[i]}: ${cell}`);
      }
      moreOf.set(file, list);
    }
  }

  const rows = (main?.rows ?? []).map((row, n): ListRow => {
    const cells: string[] = [];
    const keys: ListKey[] = [];
    for (const [i, c] of fieldColumns.entries()) {
      const [cell, key] = shown(c.kind, c.field, cellText(row[i]));
      cells.push(cell);
      keys.push(key);
    }
    const fileName = cellText(row[0]);
    for (const c of counts) {
      const k = c.per.get(fileName) ?? 0;
      cells.push(String(k));
      keys.push(k);
    }
    let failed: number | null = null;
    try {
      const r = records[n]!;
      failed = FillSession.open(t, ir, { record: r.bytes, now }).opened.invalid.length;
    } catch {
      // A record the runtime cannot open: no number is claimed.
    }
    // Spec 19 R3: beside the file name; a clean record says so.
    cells.splice(1, 0, failed === null ? '' : failed === 0 ? 'None' : String(failed));
    keys.splice(1, 0, failed);
    return { fileName, cells, keys, more: moreOf.get(fileName) ?? [] };
  });

  const columns: ListColumn[] = [
    ...fieldColumns.map(({ label, path, kind }) => ({
      label,
      kind,
      ...(path !== undefined && { path }),
    })),
    ...counts.map((c) => ({ label: c.label, kind: 'count' as const })),
  ];
  columns.splice(1, 0, { label: 'Failed checks', kind: 'checks' });
  return { columns, rows };
}
