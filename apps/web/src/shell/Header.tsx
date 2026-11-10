import { useRef } from 'react';
import sampleList from 'virtual:sample-list';
import { sampleDetail, sampleName } from './sample-names';

interface Props {
  readonly onFiles: (files: File[]) => void;
  readonly onSample: (id: string) => void;
  /** Absent while no template is open: X-ray has nothing to show. */
  readonly xray?: { readonly on: boolean; readonly toggle: () => void };
}

export function Header({ onFiles, onSample, xray }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <header className="afl-header">
      <h1>InfoPath Afterlife</h1>
      <div className="afl-header-actions">
        <button type="button" className="afl-button" onClick={() => input.current?.click()}>
          Open files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".xsn,.xml"
          hidden
          aria-label="Open files"
          data-afl-picker=""
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length > 0) onFiles(files);
          }}
        />
        <details className="afl-menu" ref={menu}>
          <summary className="afl-button">Try a sample</summary>
          <ul>
            {sampleList.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    menu.current?.removeAttribute('open');
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
      </div>
    </header>
  );
}
