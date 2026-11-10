// Spec 12 R4.1, R4.2, R3.1, R6.1: the Triage table, one row per form, then the files that could
// not be opened. A form's name opens its death certificate.
import type { TriageResult, TriageRow, Wave } from '@afterlife/core';
import { messageOf } from '../messages';
import { EMULATED_TOOLTIP, WAVE_RULES } from './words';
import './triage.css';

interface Props {
  readonly result: TriageResult;
  readonly onCertificate: (templateId: string) => void;
}

const dash = (n: number | undefined) => (n === undefined ? '—' : n);

export function TriageTable({ result, onCertificate }: Props) {
  const { totals } = result;
  const forms = result.rows.filter((r): r is TriageRow => r.kind === 'form');
  const waves = ([1, 2, 3] as const satisfies readonly Wave[]).map(
    (w) => `wave ${w}: ${totals.waves[w]}`,
  );
  return (
    <section className="afl-triage" aria-labelledby="afl-triage-h">
      <h2 id="afl-triage-h">Triage</h2>
      <p className="afl-sub">
        {totals.forms} {totals.forms === 1 ? 'form' : 'forms'}, {waves.join(', ')}.
        {totals.errors > 0 && ` ${totals.errors} could not be opened.`}
      </p>
      <div className="afl-triage-scroll">
        <table className="afl-table afl-triage-table">
          <caption className="afl-hidden">
            One row per form: wave, coverage, counts, records and causes of death
          </caption>
          <thead>
            <tr>
              <th scope="col">Form</th>
              <th scope="col">
                <span className="afl-tip">
                  <button
                    type="button"
                    className="afl-tip-button"
                    aria-describedby="afl-wave-rules"
                  >
                    Wave
                  </button>
                  <span role="tooltip" id="afl-wave-rules" className="afl-tip-body">
                    {([1, 2, 3] as const).map((w) => (
                      <span key={w}>{WAVE_RULES[w]}</span>
                    ))}
                  </span>
                </span>
              </th>
              <th scope="col">Native %</th>
              <th scope="col">Native</th>
              <th scope="col">
                <abbr title={EMULATED_TOOLTIP}>Emulated</abbr>
              </th>
              <th scope="col">Manual</th>
              <th scope="col">Unsupported</th>
              <th scope="col">Fields</th>
              <th scope="col">Views</th>
              <th scope="col">Rules</th>
              <th scope="col">Data connections</th>
              <th scope="col">Records</th>
              <th scope="col">Causes of death</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((r) => (
              <tr key={r.templateId}>
                <th scope="row">
                  <button
                    type="button"
                    className="afl-link"
                    onClick={() => onCertificate(r.templateId)}
                  >
                    {r.name}
                  </button>
                  <span className="afl-sub afl-block">
                    {r.fileName}, {r.browserCompatible ? 'browser-compatible' : 'client only'}
                  </span>
                </th>
                <td className="afl-wave" data-wave={r.wave}>
                  {r.wave}
                </td>
                <td>{dash(r.nativePercent)}</td>
                <td>{r.coverage.native}</td>
                <td>{r.coverage.emulated}</td>
                <td>{r.coverage.manual}</td>
                <td>{r.coverage.unsupported}</td>
                <td>{r.counts.fields}</td>
                <td>{r.counts.views}</td>
                <td>{r.counts.rules}</td>
                <td>{r.counts.connections}</td>
                <td>{dash(r.records)}</td>
                <td>
                  <span className="afl-chips">
                    {r.causes.map((c) => (
                      <span key={c.id} className="afl-chip">
                        {c.id}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
            {result.rows.map((r) => {
              if (r.kind !== 'error') return null;
              const m = messageOf({ code: r.code, details: {} }, r.fileName);
              return (
                <tr key={`error:${r.fileName}`} className="afl-triage-error">
                  <th scope="row">{r.fileName}</th>
                  <td colSpan={12}>
                    <strong>{m.what}</strong> {m.why} {m.action}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
