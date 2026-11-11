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
import type { SummaryQuery } from '@afterlife/core';
import type { RecordListRes, ResBody } from '../worker/protocol';
import { Summary, type SummaryPick } from './Summary';
import { findRows, searchText, whereFound, type Sort } from './find';

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
  /** Spec 20: asks the Worker for a summary of the found records. */
  readonly summarize?: (query: SummaryQuery, recordIds: readonly string[]) => Promise<ResBody>;
}

export const ROW_PX = 36;

export function Records({
  formName,
  list,
  place,
  onPlace,
  onBack,
  onOpen,
  actions,
  summarize,
}: Props) {
  const [summing, setSumming] = useState(false);
  const [pick, setPick] = useState<SummaryPick>();
  const [query, setQuery] = useState(place.query);
  const [sort, setSort] = useState(place.sort);
  const [scroll, setScroll] = useState(place.scroll);
  const [height, setHeight] = useState(600);
  const box = useRef<HTMLDivElement>(null);
  // R11: typing updates the box at once; the table follows when React has time.
  const deferred = useDeferredValue(query);
  const rows = list?.rows ?? [];
  const skip = list?.columns.findIndex((c) => c.kind === 'checks') ?? -1;
  const text = useMemo(() => searchText(rows, skip), [rows, skip]);
  const found = useMemo(() => findRows(rows, text, deferred, sort), [rows, text, deferred, sort]);
  const foundIds = useMemo(() => found.map((k) => rows[k]!.recordId), [found]);
  // Spec 20 R8: a chosen summary line narrows what Find found.
  const shown = useMemo(
    () => (pick ? found.filter((k) => pick.ids.has(rows[k]!.recordId)) : found),
    [found, pick],
  );
  const filtered = deferred.trim() !== '';
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
  const count = pick
    ? `${shown.length} of ${rows.length} ${rows.length === 1 ? 'record matches' : 'records match'} ${filtered ? 'Find and ' : ''}${pick.by}: ${pick.label}.`
    : !filtered
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
      filtered || pick !== undefined,
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
            // Spec 19 F4: Enter or Down goes to the first record found, past the column headers.
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== 'ArrowDown') return;
              const first = box.current?.querySelector<HTMLElement>('tbody th button');
              if (!first) return;
              e.preventDefault();
              first.focus();
            }}
          />
        </label>
        <p className="afl-records-count" role="status" aria-live="polite">
          {list ? count : 'Reading the records…'}
          {pick && (
            <>
              {' '}
              <button type="button" className="afl-link" onClick={() => setPick(undefined)}>
                Show every group
              </button>
            </>
          )}
        </p>
        {list && summarize && (
          <button
            type="button"
            className="afl-button"
            aria-expanded={summing}
            aria-controls="afl-summary"
            onClick={() => {
              setSumming(!summing);
              setPick(undefined);
            }}
          >
            Summarize
          </button>
        )}
        {list && actions?.(shown.map((k) => rows[k]!.recordId))}
      </div>
      {list && summarize && summing && (
        <div id="afl-summary">
          <Summary
            formName={formName}
            list={list}
            found={foundIds}
            pick={pick}
            onPick={setPick}
            ask={summarize}
          />
        </div>
      )}
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
            <tbody
              // Spec 19 F4: Up and Down move between records' file names.
              onKeyDown={(e) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                const tr = (e.target as HTMLElement).closest('tr');
                let next =
                  e.key === 'ArrowDown' ? tr?.nextElementSibling : tr?.previousElementSibling;
                while (next && !next.hasAttribute('aria-rowindex'))
                  next =
                    e.key === 'ArrowDown' ? next.nextElementSibling : next.previousElementSibling;
                const b = next?.querySelector<HTMLElement>('th button');
                if (!b) return;
                e.preventDefault();
                b.focus();
              }}
            >
              {first > 0 && <tr aria-hidden="true" style={{ height: first * ROW_PX }} />}
              {shown.slice(first, last).map((i, k) => {
                const r = rows[i]!;
                const where = whereFound(r, deferred, skip);
                return (
                  <tr key={r.recordId} aria-rowindex={first + k + 2} onClick={() => open(i)}>
                    {r.cells.map((c, j) =>
                      j === 0 ? (
                        <th key={j} scope="row">
                          <button
                            type="button"
                            className="afl-link"
                            {...(r.recordId === place.focusId && { 'data-afl-record-focus': '' })}
                            title={c}
                          >
                            {/* Spec 19 R6: on a phone the start is cut, not the end (records.css). */}
                            <span dir="ltr">{c}</span>
                          </button>
                          {where && <span className="afl-records-where"> {where}</span>}
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
          {/* Spec 19 R4: no match is said in the box, with a way back. */}
          {shown.length === 0 && rows.length > 0 && (
            <p className="afl-records-none">
              No record matches “{deferred.trim()}”.{' '}
              <button
                type="button"
                className="afl-link"
                onClick={() => {
                  setQuery('');
                  onPlace({ ...latest.current, query: '' });
                  document.querySelector<HTMLInputElement>('.afl-records-tools input')?.focus();
                }}
              >
                Clear Find
              </button>
            </p>
          )}
        </div>
      )}
    </article>
  );
}
