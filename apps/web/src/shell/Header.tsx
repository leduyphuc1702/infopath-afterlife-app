import { useRef } from 'react';
import { useMenu } from './menu';
import sampleList from 'virtual:sample-list';
import { sampleDetail, sampleName } from './sample-names';

interface Props {
  readonly onFiles: (files: File[]) => void;
  readonly onSample: (id: string) => void;
  /** Absent while no template is open: X-ray has nothing to show. */
  readonly xray?: { readonly on: boolean; readonly toggle: () => void };
  /** Spec 04 R6: the Fill switch, by X-ray. `unavailable` says why it is off-limits. */
  readonly fill?: {
    readonly on: boolean;
    readonly unavailable?: string;
    readonly toggle: () => void;
  };
  /** Spec 15 R3.1: the open form's dossier. */
  readonly onDocumentation?: () => void;
  /** Spec 12: back to Triage, when two or more templates are open. */
  readonly onTriage?: () => void;
}

export function Header({ onFiles, onSample, xray, fill, onTriage, onDocumentation }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const menu = useMenu();
  return (
    <header className="afl-header">
      <h1>InfoPath Afterlife</h1>
      <div className="afl-header-actions">
        {onTriage && (
          <button type="button" className="afl-button" onClick={onTriage}>
            Triage
          </button>
        )}
        <button type="button" className="afl-button" onClick={() => input.current?.click()}>
          Open files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".xsn,.xml,.zip"
          hidden
          aria-label="Open files"
          data-afl-picker=""
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length > 0) onFiles(files);
          }}
        />
        <details className="afl-menu" ref={menu.ref}>
          <summary className="afl-button">Try a sample</summary>
          <ul>
            {sampleList
              .filter((s) => !s.triageOnly)
              .map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      menu.close();
                      onSample(s.id);
                    }}
                  >
                    {sampleName(s.id)}
                    {sampleDetail(s.id, s.records) !== '' && (
                      <span className="afl-count">{sampleDetail(s.id, s.records)}</span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </details>
        {onDocumentation && (
          <button type="button" className="afl-button" onClick={onDocumentation}>
            Documentation
          </button>
        )}
        {xray && (
          <button
            type="button"
            className="afl-button afl-toggle"
            aria-pressed={xray.on}
            onClick={xray.toggle}
          >
            X-ray
          </button>
        )}
        {fill && (
          <button
            type="button"
            role="switch"
            className="afl-button afl-toggle afl-fill-switch"
            aria-checked={fill.on}
            aria-disabled={fill.unavailable !== undefined || undefined}
            {...(fill.unavailable !== undefined && {
              title: fill.unavailable,
              'aria-description': fill.unavailable,
            })}
            onClick={() => fill.unavailable === undefined && fill.toggle()}
          >
            Fill
          </button>
        )}
      </div>
    </header>
  );
}
