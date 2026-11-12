// Spec 18 R1: "Archive as web pages": the views to archive, then one button. On the Records
// screen it archives the records found, in the list's order. Spec 19 A2: on the form screen the
// same choice of views sits in "Export records" (ExportRecords.tsx).
import { useState } from 'react';
import type { IrView } from '@afterlife/core';
import { useMenu } from '../shell/menu';
import { viewCaption } from './PaperToolbar';

export interface ViewChoice {
  readonly chosen: ReadonlySet<string>;
  readonly names: readonly string[];
  readonly set: (name: string, on: boolean) => void;
}

export function useViewChoice(views: readonly IrView[]): ViewChoice {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(views.map((v) => v.name)),
  );
  return {
    chosen,
    names: views.filter((v) => chosen.has(v.name)).map((v) => v.name),
    set: (name, on) => {
      const next = new Set(chosen);
      if (on) next.add(name);
      else next.delete(name);
      setChosen(next);
    },
  };
}

/** The views' checkboxes, when there are two or more. */
export function ArchiveViews({ views, choice }: { views: readonly IrView[]; choice: ViewChoice }) {
  if (views.length < 2) return null;
  return (
    <>
      <li className="afl-archive-views">Views to keep as web pages:</li>
      {views.map((v) => (
        <li key={v.name}>
          <label className="afl-archive-view">
            <input
              type="checkbox"
              checked={choice.chosen.has(v.name)}
              onChange={(e) => choice.set(v.name, e.target.checked)}
            />
            {viewCaption(v)}
          </label>
        </li>
      ))}
    </>
  );
}

interface Props {
  readonly views: readonly IrView[];
  readonly count: number;
  readonly busy: boolean;
  readonly onArchive: (views: readonly string[], opener: HTMLElement | null) => void;
}

export function ArchiveMenu({ views, count, busy, onArchive }: Props) {
  const { ref, close } = useMenu();
  const choice = useViewChoice(views);
  return (
    <details className="afl-menu afl-archive" ref={ref}>
      <summary className="afl-button" data-icon="archive" aria-disabled={busy || undefined}>
        Archive as web pages
      </summary>
      <ul>
        <ArchiveViews views={views} choice={choice} />
        <li>
          <button
            type="button"
            disabled={busy || choice.names.length === 0 || count === 0}
            onClick={() => {
              const opener = ref.current?.querySelector('summary') ?? null;
              close();
              onArchive(choice.names, opener);
            }}
          >
            Archive {count} {count === 1 ? 'record' : 'records'} (.zip)
          </button>
        </li>
      </ul>
    </details>
  );
}
