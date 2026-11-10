import type { IrView } from '@afterlife/core';
import type { RecordSummary } from '../worker/protocol';

interface Props {
  readonly formName: string;
  readonly views: readonly IrView[];
  readonly view: string;
  readonly onView: (view: string) => void;
  readonly records: readonly RecordSummary[];
  readonly index: number;
  readonly onIndex: (index: number) => void;
}

export const viewCaption = (v: IrView) => v.caption ?? v.name;

/** R3.1, R3.2: the view selector and the record pager (the empty form first). */
export function PaperToolbar({ formName, views, view, onView, records, index, onIndex }: Props) {
  const record = index === 0 ? undefined : records[index - 1];
  const other = record?.match.kind === 'otherVersion' ? record.match.recordVersion : undefined;
  return (
    <div className="afl-toolbar" role="toolbar" aria-label="Views and records">
      <span className="afl-form-name">{formName}</span>
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
        disabled={index === 0}
        onClick={() => onIndex(index - 1)}
      >
        Previous
      </button>
      <span aria-live="polite" className="afl-position">
        {record ? `Record ${index} of ${records.length}, ${record.fileName}` : 'Empty form'}
      </span>
      <button
        type="button"
        className="afl-button"
        disabled={index >= records.length}
        onClick={() => onIndex(index + 1)}
      >
        Next
      </button>
      {other !== undefined && <span className="afl-badge">Made with version {other}</span>}
    </div>
  );
}
