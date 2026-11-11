// Spec 20: the records found, grouped by one column, counted and totalled in the Worker. The
// table is the content; the bars are decoration (aria-hidden). Values are React text only.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SummaryQuery, SummarySortColumn } from '@afterlife/core';
import type { RecordListRes, ResBody, SummaryRes } from '../worker/protocol';
import { save } from '../paper/ExportRecords';

/** Spec 22 S1: the choices, kept by the Records screen across opening a record. */
export interface SummaryState {
  readonly unit: number;
  readonly by: number;
  readonly dates: 'year' | 'month';
  readonly total?: number;
  readonly sort: { readonly column: SummarySortColumn; readonly descending: boolean };
}

/** A group line chosen: the list shows its records. */
export interface SummaryPick {
  readonly by: string;
  readonly label: string;
  readonly ids: ReadonlySet<string>;
}

interface Props {
  readonly formName: string;
  readonly list: RecordListRes;
  /** The record ids Find has found, in the list's order. */
  readonly found: readonly string[];
  readonly pick: SummaryPick | undefined;
  readonly onPick: (p: SummaryPick | undefined) => void;
  readonly ask: (query: SummaryQuery, recordIds: readonly string[]) => Promise<ResBody>;
  readonly initial?: SummaryState | undefined;
  readonly onState?: (s: SummaryState) => void;
  readonly onSaved?: (fileName: string, groups: number) => void;
}

const num = (n: number) => n.toLocaleString('en-US');

const columnsOf = (list: RecordListRes, unit: number) => [
  ...list.columns,
  ...(unit >= 0 ? (list.parts[unit]?.columns ?? []) : []),
];

/** R1 default: the record column with the fewest different values (at least two). */
function firstBy(list: RecordListRes): number {
  let best = -1;
  let fewest = Infinity;
  list.columns.forEach((c, i) => {
    if (i < 3 || (c.kind !== 'text' && c.kind !== 'date')) return;
    const n = new Set(list.rows.map((r) => r.cells[i])).size;
    if (n >= 2 && n < fewest) [best, fewest] = [i, n];
  });
  return best < 0 ? Math.min(2, list.columns.length - 1) : best;
}

export function Summary({
  formName,
  list,
  found,
  pick,
  onPick,
  ask,
  initial,
  onState,
  onSaved,
}: Props) {
  const [unit, setUnit] = useState(initial?.unit ?? -1);
  const [by, setBy] = useState(() => initial?.by ?? firstBy(list));
  const [dates, setDates] = useState<'year' | 'month'>(initial?.dates ?? 'year');
  const [total, setTotal] = useState<number | undefined>(initial?.total);
  const [sort, setSort] = useState<{ column: SummarySortColumn; descending: boolean }>(
    initial?.sort ?? { column: 'group', descending: false },
  );
  useEffect(() => {
    onState?.({ unit, by, dates, ...(total !== undefined && { total }), sort });
  }, [unit, by, dates, total, sort]);
  const [res, setRes] = useState<SummaryRes>();
  const asked = useRef(0);
  const columns = useMemo(() => columnsOf(list, unit), [list, unit]);
  const date = columns[by]?.kind === 'date';
  const query: SummaryQuery = {
    unit,
    by,
    ...(date && { dates }),
    ...(total !== undefined && { total }),
    sort,
  };
  const key = JSON.stringify(query);

  // R10: asked again shortly after Find or a choice changes; the latest answer wins.
  useEffect(() => {
    const n = ++asked.current;
    const t = setTimeout(() => {
      void ask(query, found).then((r) => {
        if (n !== asked.current || r.type !== 'summary') return;
        setRes(r);
        console.debug(`R10 summary: worker ${r.ms} ms`);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [key, found]);

  // R8: a chosen line follows the summary as Find changes; gone when its group is.
  useEffect(() => {
    if (!res || !pick) return;
    const line = res.lines.find((l) => l.label === pick.label);
    if (!line || pick.by !== res.byLabel) onPick(undefined);
    else {
      const ids = new Set(line.records.map((i) => list.rows[i]!.recordId));
      if (ids.size !== pick.ids.size || [...ids].some((id) => !pick.ids.has(id)))
        onPick({ ...pick, ids });
    }
  }, [res]);

  const sortBy = (column: SummarySortColumn) =>
    setSort({ column, descending: sort.column === column ? !sort.descending : column !== 'group' });
  const head = (column: SummarySortColumn, label: string) => (
    <th
      scope="col"
      aria-sort={
        sort.column === column ? (sort.descending ? 'descending' : 'ascending') : undefined
      }
    >
      <button type="button" onClick={() => sortBy(column)}>
        {label}
        <span aria-hidden="true">
          {sort.column === column ? (sort.descending ? ' ▼' : ' ▲') : ''}
        </span>
      </button>
    </th>
  );
  const withBar = (text: string | number, bar: number) => (
    <>
      <span className="afl-summary-bar" aria-hidden="true" style={{ width: `${bar * 100}%` }} />
      <span className="afl-summary-n">{text}</span>
    </>
  );
  const totalled = res?.totalLabel !== undefined;
  const slug =
    formName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'form';

  return (
    <section className="afl-summary" aria-labelledby="afl-summary-h">
      <h3 id="afl-summary-h">Summary of the records found</h3>
      <div className="afl-summary-tools">
        <label className="afl-field">
          Count
          <select
            value={unit}
            onChange={(e) => {
              setUnit(Number(e.target.value));
              setTotal(undefined);
              if (by >= list.columns.length) setBy(firstBy(list));
            }}
          >
            <option value={-1}>Records</option>
            {list.parts.map((p, i) => (
              <option key={i} value={i}>
                {p.label} rows
              </option>
            ))}
          </select>
        </label>
        <label className="afl-field">
          Group by
          <select value={by} onChange={(e) => setBy(Number(e.target.value))}>
            {columns.map((c, i) =>
              i === 0 ? null : (
                <option key={i} value={i}>
                  {c.label}
                </option>
              ),
            )}
          </select>
        </label>
        {date && (
          <label className="afl-field">
            By
            <select value={dates} onChange={(e) => setDates(e.target.value as 'year' | 'month')}>
              <option value="year">Year</option>
              <option value="month">Month</option>
            </select>
          </label>
        )}
        <label className="afl-field">
          Total of
          <select
            value={total ?? ''}
            onChange={(e) => setTotal(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">Nothing, count only</option>
            {columns.map((c, i) =>
              c.kind === 'number' ? (
                <option key={i} value={i}>
                  {c.label}
                </option>
              ) : null,
            )}
          </select>
        </label>
        <button
          type="button"
          className="afl-button"
          disabled={!res || res.tooMany !== undefined || res.lines.length === 0}
          onClick={() => {
            if (!res) return;
            save(
              new TextEncoder().encode(res.csv).buffer,
              `${slug}-summary.csv`,
              'text/csv;charset=utf-8',
            );
            // Spec 22 S2: say what was saved; focus stays on this button.
            onSaved?.(`${slug}-summary.csv`, res.lines.length);
          }}
        >
          Download CSV
        </button>
      </div>
      {!res ? (
        <p>Summarizing…</p>
      ) : res.all.count === 0 && found.length === 0 ? (
        // Spec 22 F4: nothing found, nothing to group.
        <p className="afl-summary-many">
          Find matches no record, so there is nothing to summarize.
        </p>
      ) : res.tooMany !== undefined ? (
        <p className="afl-summary-many">
          {res.byLabel} has {res.tooMany} different values, too many to group by. Choose a column
          with 50 or fewer, or group a date by year or month.
        </p>
      ) : (
        <div className="afl-summary-box">
          <table className="afl-summary-table">
            <caption>
              {res.counted}, grouped by {res.byLabel}
              {totalled ? `, with the total of ${res.totalLabel}` : ''}. Choose a group to list its
              records.
            </caption>
            <thead>
              <tr>
                {head('group', res.byLabel)}
                {head('count', `Count (${res.unitWord})`)}
                {totalled && head('sum', `Sum of ${res.totalLabel}`)}
                {totalled && head('average', `Average of ${res.totalLabel}`)}
              </tr>
            </thead>
            <tbody>
              {res.lines.map((l) => (
                <tr key={l.label} className={pick?.label === l.label ? 'afl-summary-picked' : ''}>
                  <th scope="row">
                    <button
                      type="button"
                      className="afl-link"
                      aria-pressed={pick?.label === l.label}
                      onClick={() =>
                        onPick(
                          pick?.label === l.label
                            ? undefined
                            : {
                                by: res.byLabel,
                                label: l.label,
                                ids: new Set(l.records.map((i) => list.rows[i]!.recordId)),
                              },
                        )
                      }
                    >
                      {l.label}
                    </button>
                  </th>
                  <td>{totalled ? num(l.count) : withBar(num(l.count), l.bar)}</td>
                  {totalled && <td>{withBar(l.sum ?? '', l.bar)}</td>}
                  {totalled && <td>{l.average}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">All</th>
                <td>{num(res.all.count)}</td>
                {totalled && <td>{res.all.sum}</td>}
                {totalled && <td>{res.all.average}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
