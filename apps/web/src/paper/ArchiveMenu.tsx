// Spec 18 R1: "Archive as web pages": the views to archive, then one button. On the form screen
// it archives every record; on the Records screen, the records found, in the list's order.
import { useState } from 'react';
import type { IrView } from '@afterlife/core';
import { useMenu } from '../shell/menu';
import { viewCaption } from './PaperToolbar';

interface Props {
  readonly views: readonly IrView[];
  readonly count: number;
  readonly busy: boolean;
  readonly onArchive: (views: readonly string[]) => void;
}

export function ArchiveMenu({ views, count, busy, onArchive }: Props) {
  const { ref, close } = useMenu();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(views.map((v) => v.name)),
  );
  const names = views.filter((v) => chosen.has(v.name)).map((v) => v.name);
  return (
    <details className="afl-menu afl-archive" ref={ref}>
      <summary className="afl-button" aria-disabled={busy || undefined}>
        Archive as web pages
      </summary>
      <ul>
        {views.length > 1 && <li className="afl-archive-views">Views to archive:</li>}
        {views.length > 1 &&
          views.map((v) => (
            <li key={v.name}>
              <label className="afl-archive-view">
                <input
                  type="checkbox"
                  checked={chosen.has(v.name)}
                  onChange={(e) => {
                    const next = new Set(chosen);
                    if (e.target.checked) next.add(v.name);
                    else next.delete(v.name);
                    setChosen(next);
                  }}
                />
                {viewCaption(v)}
              </label>
            </li>
          ))}
        <li>
          <button
            type="button"
            disabled={busy || names.length === 0 || count === 0}
            onClick={() => {
              close();
              onArchive(names);
            }}
          >
            Archive {count} {count === 1 ? 'record' : 'records'} (.zip)
          </button>
        </li>
      </ul>
    </details>
  );
}
