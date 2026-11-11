// Spec 20: the records found, grouped by one column, with the count and, for a number column,
// the sum and the average of each group. Pure over a `RecordList`, so the Worker answers it from
// the list it already holds. Sums are exact (scaled bigints): the same in any order, and the
// group sums add up to the total (P22).
import { formatString } from '../xpath-fns/format';
import { sheetCsv } from './export';
import type { ListColumn, ListKey, RecordList } from './list';

export const MAX_GROUPS = 50;

export type SummarySortColumn = 'group' | 'count' | 'sum' | 'average';

export interface SummaryQuery {
  /** -1: count records; otherwise the index of the repeating group (`RecordList.parts`). */
  readonly unit: number;
  /** Index into `summaryColumns(list, unit)`. */
  readonly by: number;
  readonly dates?: 'year' | 'month';
  readonly total?: number;
  readonly sort?: { readonly column: SummarySortColumn; readonly descending: boolean };
}

export interface SummaryLine {
  readonly label: string;
  readonly count: number;
  /** Exact decimal text, and as shown. */
  readonly sumRaw?: string;
  readonly sum?: string;
  readonly average?: string;
  /** 0–1: the bar beside the sum (or the count), against the largest line. */
  readonly bar: number;
  /** The list rows (records) in the group, ascending. */
  readonly records: readonly number[];
}

export interface Summary {
  /** "30 records", "68 Expense rows in 30 records". */
  readonly counted: string;
  readonly unitWord: string;
  readonly byLabel: string;
  readonly totalLabel?: string;
  readonly lines: readonly SummaryLine[];
  readonly all: Omit<SummaryLine, 'label' | 'bar' | 'records'>;
  /** Set instead of `lines` when the column has more than `MAX_GROUPS` values. */
  readonly tooMany?: number;
  readonly csv: string;
}

export function summaryColumns(list: RecordList, unit: number): readonly ListColumn[] {
  const part = unit >= 0 ? list.parts[unit] : undefined;
  return part ? [...list.columns, ...part.columns] : list.columns;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A decimal as `value / 10^scale`; `undefined` for anything that is not a finite number. */
function decimal(k: ListKey): { value: bigint; scale: number } | undefined {
  if (typeof k !== 'number' || !Number.isFinite(k)) return undefined;
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(k));
  if (!m) return undefined;
  const digits = m[2]! + (m[3] ?? '');
  let scale = (m[3] ?? '').length - Number(m[4] ?? 0);
  let value = BigInt(digits);
  if (scale < 0) {
    value *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { value: m[1] ? -value : value, scale };
}
const rescale = (v: bigint, from: number, to: number) => v * 10n ** BigInt(to - from);
function decimalText(v: bigint, scale: number): string {
  const neg = v < 0n;
  const s = (neg ? -v : v).toString().padStart(scale + 1, '0');
  const int = s.slice(0, s.length - scale);
  const frac = s.slice(s.length - scale).replace(/0+$/, '');
  return (neg ? '-' : '') + int + (frac ? '.' + frac : '');
}

export function summarize(
  list: RecordList,
  query: SummaryQuery,
  found: readonly number[],
): Summary {
  const part = query.unit >= 0 ? list.parts[query.unit] : undefined;
  const columns = summaryColumns(list, query.unit);
  const by = columns[query.by];
  if (!by) throw new RangeError(`no column ${query.by}`);
  const total = query.total === undefined ? undefined : columns[query.total];
  const width = list.columns.length;

  // The units: a record, or a row of the part whose record is found.
  const isFound = new Set(found);
  type Unit = { record: number; cell: (i: number) => string; key: (i: number) => ListKey };
  const units: Unit[] = [];
  for (const r of [...isFound].sort((a, b) => a - b)) {
    const row = list.rows[r];
    if (row && !part)
      units.push({ record: r, cell: (i) => row.cells[i] ?? '', key: (i) => row.keys[i] ?? null });
  }
  if (part)
    for (const p of part.rows) {
      if (!isFound.has(p.record)) continue;
      const row = list.rows[p.record]!;
      units.push({
        record: p.record,
        cell: (i) => (i < width ? row.cells[i] : p.cells[i - width]) ?? '',
        key: (i) => (i < width ? row.keys[i] : p.keys[i - width]) ?? null,
      });
    }

  const groupOf = (u: Unit): { id: string; label: string; order: ListKey } => {
    const key = u.key(query.by);
    const text = u.cell(query.by);
    if (by.kind === 'date' && typeof key === 'string' && /^\d{4}-\d{2}/.test(key)) {
      if (query.dates === 'month') {
        const id = key.slice(0, 7);
        return {
          id,
          label: `${MONTHS[Number(key.slice(5, 7)) - 1] ?? key.slice(5, 7)} ${key.slice(0, 4)}`,
          order: id,
        };
      }
      return { id: key.slice(0, 4), label: key.slice(0, 4), order: key.slice(0, 4) };
    }
    if (text.trim() === '') return { id: '\u0000', label: 'No value', order: null };
    return { id: text, label: text, order: key ?? text };
  };

  interface Acc {
    label: string;
    order: ListKey;
    count: number;
    n: number;
    sum: bigint;
    scale: number;
    records: Set<number>;
  }
  const groups = new Map<string, Acc>();
  const all: Acc = {
    label: '',
    order: null,
    count: 0,
    n: 0,
    sum: 0n,
    scale: 0,
    records: new Set(),
  };
  const add = (a: Acc, d: { value: bigint; scale: number } | undefined) => {
    a.count++;
    if (!d) return;
    const scale = Math.max(a.scale, d.scale);
    a.sum = rescale(a.sum, a.scale, scale) + rescale(d.value, d.scale, scale);
    a.scale = scale;
    a.n++;
  };
  for (const u of units) {
    const g = groupOf(u);
    let a = groups.get(g.id);
    if (!a) {
      a = { label: g.label, order: g.order, count: 0, n: 0, sum: 0n, scale: 0, records: new Set() };
      groups.set(g.id, a);
    }
    const d = query.total === undefined ? undefined : decimal(u.key(query.total));
    add(a, d);
    add(all, d);
    a.records.add(u.record);
    all.records.add(u.record);
  }

  // Shown in the view's format; the average to the values' decimals plus two.
  const scaleOf = Math.max(0, ...[...groups.values()].map((a) => a.scale), all.scale);
  const fmt = total?.format;
  const show = (text: string) => (fmt ? formatString(text, fmt.type, fmt.options) : text);
  const figures = (a: Acc) => {
    if (!total) return {};
    if (a.n === 0) return { sumRaw: '0', sum: '', average: '' };
    const sumRaw = decimalText(a.sum, a.scale);
    const avg = Number(sumRaw) / a.n;
    const average = String(Number(avg.toFixed(Math.min(20, scaleOf + 2))));
    return { sumRaw, sum: show(sumRaw), average: show(average) };
  };

  const word = part ? `${part.label} rows` : 'records';
  const one = part ? `${part.label} row` : 'record';
  const counted = part
    ? `${units.length} ${units.length === 1 ? one : word} in ${all.records.size} ${all.records.size === 1 ? 'record' : 'records'}`
    : `${units.length} ${units.length === 1 ? one : word}`;
  const head = {
    counted,
    unitWord: word,
    byLabel:
      by.label + (by.kind === 'date' ? (query.dates === 'month' ? ' (month)' : ' (year)') : ''),
    ...(total && { totalLabel: total.label }),
    all: { count: all.count, ...figures(all) },
  };
  if (groups.size > MAX_GROUPS) return { ...head, lines: [], tooMany: groups.size, csv: '' };

  const cmpKey = (a: ListKey, b: ListKey) =>
    a === b
      ? 0
      : a === null
        ? 1
        : b === null
          ? -1
          : typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b), 'en');
  const avgOf = (a: Acc) => (a.n ? Number(decimalText(a.sum, a.scale)) / a.n : -Infinity);
  const sumCmp = (a: Acc, b: Acc) => {
    const s = Math.max(a.scale, b.scale);
    const x = rescale(a.sum, a.scale, s);
    const y = rescale(b.sum, b.scale, s);
    return x < y ? -1 : x > y ? 1 : 0;
  };
  const sort = query.sort ?? { column: 'group', descending: false };
  const accs = [...groups.values()].sort((a, b) => {
    const byGroup =
      cmpKey(a.order, b.order) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
    const c =
      sort.column === 'count'
        ? a.count - b.count
        : sort.column === 'sum'
          ? sumCmp(a, b)
          : sort.column === 'average'
            ? avgOf(a) - avgOf(b)
            : byGroup;
    return (sort.descending ? -c : c) || byGroup;
  });
  const size = (a: Acc) => (total ? Math.abs(Number(decimalText(a.sum, a.scale))) : a.count);
  const largest = Math.max(0, ...accs.map(size));
  const lines = accs.map((a): SummaryLine => ({
    label: a.label,
    count: a.count,
    ...figures(a),
    bar: largest > 0 ? size(a) / largest : 0,
    records: [...a.records].sort((x, y) => x - y),
  }));

  const csvRow = (label: string, l: { count: number; sumRaw?: string }, avg?: string) => [
    label,
    { number: String(l.count) },
    ...(total ? [{ number: l.sumRaw ?? '' }, { number: avg ?? '' }] : []),
  ];
  const avgRaw = (a: Acc) =>
    a.n
      ? String(
          Number((Number(decimalText(a.sum, a.scale)) / a.n).toFixed(Math.min(20, scaleOf + 2))),
        )
      : '';
  const csv = sheetCsv({
    name: 'Summary',
    columns: [
      head.byLabel,
      `Count (${word})`,
      ...(total ? [`Sum of ${total.label}`, `Average of ${total.label}`] : []),
    ],
    rows: [
      ...accs.map((a, i) =>
        csvRow(lines[i]!.label, { count: a.count, sumRaw: lines[i]!.sumRaw ?? '' }, avgRaw(a)),
      ),
      csvRow('All', { count: all.count, sumRaw: head.all.sumRaw ?? '' }, avgRaw(all)),
    ],
  });
  return { ...head, lines, csv };
}
