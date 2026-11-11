// Spec 17: the records list of the open form. Find, sort, open. Only the rows near the screen
// are drawn (R11), and values are React text children only (R12).
import {
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RecordListRes } from '../worker/protocol';
import { findRows, searchText, type Sort } from './find';

/** What Back to the list restores (R9). */
export interface ListPlace {
  readonly query: string;
  readonly sort?: Sort;
  readonly scroll: number;
  readonly focusId?: string;
}

interface Props {
  readonly formName: string;
  readonly list: RecordListRes | undefined;
  readonly place: ListPlace;
  readonly onPlace: (p: ListPlace) => void;
  readonly onBack: () => void;
  /** Opens one record; `order` is the shown rows' record ids, `found` whether Find filtered. */
  readonly onOpen: (recordId: string, order: readonly string[], found: boolean) => void;
  /** Spec 18 R1: tools given the shown rows' record ids, in order. */
  readonly actions?: (order: readonly string[]) => ReactNode;
}

export const ROW_PX = 36;

export function Records({ formName, list, place, onPlace, onBack, onOpen, actions }: Props) {
  const [query, setQuery] = useState(place.query);
  const [sort, setSort] = useState(place.sort);
  const [scroll, setScroll] = useState(place.scroll);
  const [height, setHeight] = useState(600);
  const box = useRef<HTMLDivElement>(null);
  // R11: typing updates the box at once; the table follows when React has time.
  const deferred = useDeferredValue(query);
  const rows = list?.rows ?? [];
  const text = useMemo(() => searchText(rows), [rows]);
  const shown = useMemo(() => findRows(rows, text, deferred, sort), [rows, text, deferred, sort]);
  const latest = useRef(place);
  latest.current = {
    query,
    ...(sort && { sort }),
    scroll,
    ...(place.focusId !== undefined && { focusId: place.focusId }),
  };
  const report = () => onPlace(latest.current);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = place.scroll;
    setHeight(el.clientHeight || 600);
    // Mount only: the place to come back to is restored once.
  }, [list !== undefined]);

  const first = Math.max(0, Math.floor(scroll / ROW_PX) - Math.ceil(height / ROW_PX));
  const last = Math.min(shown.length, Math.ceil((scroll + 2 * height) / ROW_PX));
  const count =
    deferred.trim() === ''
      ? `${rows.length} ${rows.length === 1 ? 'record' : 'records'}.`
      : `${shown.length} of ${rows.length} ${rows.length === 1 ? 'record matches' : 'records match'}.`;

  const sortBy = (column: number) => {
    const next = { column, descending: sort?.column === column && !sort.descending };
    setSort(next);
    onPlace({ ...latest.current, sort: next });
  };
  const open = (i: number) => {
    const id = rows[i]!.recordId;
    onPlace({ ...latest.current, focusId: id });
    onOpen(
      id,
      shown.map((k) => rows[k]!.recordId),
      deferred.trim() !== '',
    );
  };

  return (
    <article className="afl-records" aria-labelledby="afl-records-h">
      <h2 id="afl-records-h" tabIndex={-1}>
        {formName}: records
      </h2>
      <div className="afl-records-tools">
        <button type="button" className="afl-link" onClick={onBack}>
          Back
        </button>
        <label className="afl-field">
          Find
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onPlace({ ...latest.current, query: e.target.value });
            }}
          />
        </label>
        <p className="afl-records-count" role="status" aria-live="polite">
          {list ? count : 'Reading the records…'}
        </p>
        {list && actions?.(shown.map((k) => rows[k]!.recordId))}
      </div>
      {list && (
        <div
          ref={box}
          className="afl-records-box"
          tabIndex={-1}
          onScroll={(e) => {
            setScroll(e.currentTarget.scrollTop);
            latest.current = { ...latest.current, scroll: e.currentTarget.scrollTop };
            report();
          }}
        >
          <table
            className="afl-records-table"
            aria-rowcount={shown.length + 1}
            aria-labelledby="afl-records-h"
          >
            <thead>
              <tr aria-rowindex={1}>
                {list.columns.map((c, i) => (
                  <th
                    key={i}
                    scope="col"
                    aria-sort={
                      sort?.column === i
                        ? sort.descending
                          ? 'descending'
                          : 'ascending'
                        : undefined
                    }
                  >
                    <button type="button" onClick={() => sortBy(i)}>
                      {c.label}
                      <span aria-hidden="true">
                        {sort?.column === i ? (sort.descending ? ' ▼' : ' ▲') : ''}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {first > 0 && <tr aria-hidden="true" style={{ height: first * ROW_PX }} />}
              {shown.slice(first, last).map((i, k) => {
                const r = rows[i]!;
                return (
                  <tr key={r.recordId} aria-rowindex={first + k + 2} onClick={() => open(i)}>
                    {r.cells.map((c, j) =>
                      j === 0 ? (
                        <th key={j} scope="row">
                          <button
                            type="button"
                            className="afl-link"
                            {...(r.recordId === place.focusId && { 'data-afl-record-focus': '' })}
                          >
                            {c}
                          </button>
                        </th>
                      ) : (
                        <td
                          key={j}
                          className={list.columns[j]!.kind === 'text' ? undefined : 'afl-num'}
                          title={c.length > 24 ? c : undefined}
                        >
                          {c}
                        </td>
                      ),
                    )}
                  </tr>
                );
              })}
              {last < shown.length && (
                <tr aria-hidden="true" style={{ height: (shown.length - last) * ROW_PX }} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
