// Spec 09 R12.1–R12.4: "Export records", beside the pager when the open template has records.
// The Worker builds the file; the page only saves the finished bytes through a `blob:` URL.
import { useEffect } from 'react';
import type { IrView } from '@afterlife/core';
import { useMenu } from '../shell/menu';
import { ArchiveViews, useViewChoice } from './ArchiveMenu';

export type RecordFormat = 'xlsx' | 'csv';

interface Props {
  readonly onExport: (format: RecordFormat) => void;
  readonly busy: boolean;
  /** Spec 19 A2: "Archive as web pages" is the menu's third choice, with the views to archive. */
  readonly views: readonly IrView[];
  readonly onArchive: (views: readonly string[], opener: HTMLElement | null) => void;
  /** Spec 21: the "keep" task lands with the choices showing. */
  readonly startOpen?: boolean;
}

export function ExportRecords({ onExport, busy, views, onArchive, startOpen }: Props) {
  const { ref, close } = useMenu();
  useEffect(() => {
    if (startOpen && ref.current) ref.current.open = true;
  }, [startOpen]);
  const choice = useViewChoice(views);
  const pick = (format: RecordFormat) => {
    close();
    onExport(format);
  };
  return (
    <details className="afl-menu afl-export-records" ref={ref}>
      <summary className="afl-button" data-icon="download" aria-disabled={busy || undefined}>
        Export records
      </summary>
      <ul>
        <li>
          <button type="button" disabled={busy} onClick={() => pick('xlsx')}>
            Excel workbook (.xlsx)
          </button>
        </li>
        <li>
          <button type="button" disabled={busy} onClick={() => pick('csv')}>
            CSV files and attachments (.zip)
          </button>
        </li>
        <ArchiveViews views={views} choice={choice} />
        <li>
          <button
            type="button"
            disabled={busy || choice.names.length === 0}
            onClick={() => {
              const opener = ref.current?.querySelector('summary') ?? null;
              close();
              onArchive(choice.names, opener);
            }}
          >
            Web pages to keep (.zip)
          </button>
        </li>
      </ul>
    </details>
  );
}

/** Saves bytes the Worker made, with no request: a `blob:` URL clicked, then revoked. */
export function save(bytes: ArrayBuffer, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
