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
  /** The first screen: the product name leads to its top. */
  readonly landing?: boolean;
  /** The product name leads back to the first screen. */
  readonly onHome?: () => void;
}

export const REPO = 'https://github.com/leduyphuc1702/infopath-afterlife-app';
/** The product's page: what the app is and who it is for. */
export const SITE = 'https://leduyphuc1702.github.io/infopath-afterlife-app/';

/** The mark: a form sheet under a halo. Drawn for this app; its colours are tokens (saas.css). */
export const Logo = () => (
  <svg className="afl-logo" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" />
    <ellipse cx="16" cy="7" rx="6" ry="2" />
    <path d="M11 11h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" />
    <path d="M12.5 16h7M12.5 19.5h7M12.5 23h4" />
  </svg>
);

export function Header({
  onFiles,
  onSample,
  xray,
  fill,
  onTriage,
  onDocumentation,
  landing,
  onHome,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const menu = useMenu();
  return (
    <header className="afl-header">
      <h1>
        <a
          href="./"
          className="afl-brand"
          onClick={(e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            if (landing) window.scrollTo({ top: 0, behavior: 'smooth' });
            else onHome?.();
          }}
        >
          <Logo />
          InfoPath Afterlife
        </a>
      </h1>
      <div className="afl-header-actions">
        {onTriage && (
          <button type="button" className="afl-button" data-icon="table" onClick={onTriage}>
            Triage
          </button>
        )}
        <button
          type="button"
          className="afl-button afl-icon-b"
          data-icon="folder"
          title="Open files"
          onClick={() => input.current?.click()}
        >
          <span className="afl-hidden">Open files</span>
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
          <summary className="afl-button afl-icon-b" data-icon="flask" title="Try a sample">
            <span className="afl-hidden">Try a sample</span>
          </summary>
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
          <button
            type="button"
            className="afl-button afl-icon-b"
            data-icon="doc"
            title="Documentation"
            onClick={onDocumentation}
          >
            <span className="afl-hidden">Documentation</span>
          </button>
        )}
        {xray && (
          <button
            type="button"
            className="afl-button afl-toggle"
            data-icon="xray"
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
            data-icon="pencil"
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
