import type { IrView } from '@afterlife/core';
import type { ReactNode } from 'react';
import type { RecordSummary } from '../worker/protocol';

interface Props {
  readonly formName: string;
  readonly views: readonly IrView[];
  readonly view: string;
  readonly onView: (view: string) => void;
  readonly records: readonly RecordSummary[];
  readonly index: number;
  readonly onIndex: (index: number) => void;
  /** Spec 09 R12.1: the "Export records" menu, after the pager. */
  readonly actions?: ReactNode;
  /** Spec 17 R10: the records list's shown rows (record indices), when one was opened from it. */
  readonly walk?: { readonly order: readonly number[]; readonly found: boolean };
  /** Spec 17 R1: opens the records list. */
  readonly onRecords?: () => void;
}

export const viewCaption = (v: IrView) => v.caption ?? v.name;

/** R3.1, R3.2: the view selector and the record pager (the empty form first). */
export function PaperToolbar({
  formName,
  views,
  view,
  onView,
  records,
  index,
  onIndex,
  actions,
  walk,
  onRecords,
}: Props) {
  const record = index === 0 ? undefined : records[index - 1];
  const at = walk ? walk.order.indexOf(index) : -1;
  const prev = at >= 0 ? walk!.order[at - 1] : index > 0 ? index - 1 : undefined;
  const next = at >= 0 ? walk!.order[at + 1] : index < records.length ? index + 1 : undefined;
  const position = !record
    ? 'Empty form'
    : at >= 0
      ? `Record ${at + 1} of ${walk!.order.length}${walk!.found ? ' found' : ''}, ${record.fileName}`
      : `Record ${index} of ${records.length}, ${record.fileName}`;
  const other = record?.match.kind === 'otherVersion' ? record.match.recordVersion : undefined;
  return (
    <div className="afl-toolbar" role="toolbar" aria-label="Views and records">
      {/* Spec 13 B6: the form screen's heading, focused when the screen opens. */}
      <h2 className="afl-form-name" tabIndex={-1}>
        {formName}
      </h2>
      <label className="afl-field">
        View
        <select value={view} onChange={(e) => onView(e.target.value)}>
          {views.map((v) => (
            <option key={v.name} value={v.name}>
              {viewCaption(v)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="afl-button"
        disabled={prev === undefined}
        onClick={() => prev !== undefined && onIndex(prev)}
      >
        Previous
      </button>
      <span aria-live="polite" className="afl-position">
        {position}
      </span>
      <button
        type="button"
        className="afl-button"
        disabled={next === undefined}
        onClick={() => next !== undefined && onIndex(next)}
      >
        Next
      </button>
      {onRecords && (
        <button type="button" className="afl-button" onClick={onRecords}>
          Records
        </button>
      )}
      {other !== undefined && <span className="afl-badge">Made with version {other}</span>}
      {actions}
    </div>
  );
}
