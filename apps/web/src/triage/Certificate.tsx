// Spec 12 R2.3, R4.3: one form's death certificate. Only causes with evidence in the files, each
// with its date (or "—"), its source, its evidence and what replaces it; then the workflow line.
import type { TriageRow } from '@afterlife/core';
import { CAUSE_TITLES, EMULATED_TOOLTIP, shortPath, WAVE_RULES, WORKFLOW_LINE } from './words';
import './triage.css';

interface Props {
  readonly row: TriageRow;
  readonly onOpenForm: () => void;
  /** Spec 15 R3.1. */
  readonly onDocumentation: () => void;
  readonly onBack: () => void;
}

export function Certificate({ row, onOpenForm, onDocumentation, onBack }: Props) {
  const c = row.coverage;
  return (
    <section className="afl-certificate" aria-labelledby="afl-cert-h">
      <p className="afl-no-print">
        <button type="button" className="afl-link" onClick={onBack}>
          Back to Triage
        </button>
      </p>
      <h2 id="afl-cert-h" tabIndex={-1}>
        Death certificate: {row.name}
      </h2>
      <p className="afl-sub">
        {row.fileName}, InfoPath{' '}
        {row.generation === 'unknown' ? '(version unknown)' : row.generation},{' '}
        {row.browserCompatible ? 'browser-compatible' : 'client only'}
      </p>
      <div className="afl-cert-summary">
        <span className="afl-wave" data-wave={row.wave}>
          Wave {row.wave}
        </span>
        <span>{WAVE_RULES[row.wave].replace(/^Wave \d: /, '')}</span>
        <span className="afl-sub">
          Native {c.native}, <abbr title={EMULATED_TOOLTIP}>Emulated</abbr> {c.emulated}, Manual{' '}
          {c.manual}, Unsupported {c.unsupported}
          {row.nativePercent !== undefined && ` (${row.nativePercent}% native)`}
        </span>
        <button type="button" className="afl-button afl-no-print" onClick={onOpenForm}>
          Open form
        </button>
        <button type="button" className="afl-button afl-no-print" onClick={onDocumentation}>
          Documentation
        </button>
      </div>
      <h3 className="afl-cert-causes">Causes of death ({row.causes.length})</h3>
      {row.causes.map((cause, i) => (
        <article key={cause.id} className="afl-cause" aria-labelledby={`afl-cause-${i}`}>
          <h4 id={`afl-cause-${i}`}>
            {CAUSE_TITLES[cause.id]} <code className="afl-sub">{cause.id}</code>
          </h4>
          <dl className="afl-facts">
            <dt>Date</dt>
            <dd>{cause.dateWords}</dd>
            <dt>Source</dt>
            <dd>
              {cause.source ? (
                <a href={cause.source.url} target="_blank" rel="noreferrer">
                  {cause.source.title}
                </a>
              ) : (
                '—'
              )}
            </dd>
            <dt>Replaced by</dt>
            <dd>{cause.replacement}</dd>
          </dl>
          <h5>Evidence {cause.from === 'record' ? 'in the records' : 'in the template'}</h5>
          <ul className="afl-refs">
            {cause.evidence.map((e, n) => (
              <li key={n}>
                {e.what}
                <code className="afl-expr" title={e.located.path}>
                  {e.located.file} › {shortPath(e.located.path)}
                </code>
                {e.replacement !== undefined && e.replacement !== cause.replacement && (
                  <span className="afl-sub afl-block">Replaced by: {e.replacement}</span>
                )}
              </li>
            ))}
          </ul>
        </article>
      ))}
      <p className="afl-workflow">{WORKFLOW_LINE}</p>
    </section>
  );
}
