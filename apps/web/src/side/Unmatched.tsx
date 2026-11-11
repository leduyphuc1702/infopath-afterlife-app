import { useEffect, useRef } from 'react';
import type { RecordSummary } from '../worker/protocol';

/** R2.2: records no open template made, each with its reason; and files that are not forms. */
export function Unmatched({
  records,
  ignored,
  focus,
}: {
  readonly records: readonly RecordSummary[];
  readonly ignored: readonly string[];
  /** Spec 22 F2: on the landing page nothing else changed, so the first list takes focus. */
  readonly focus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = `${records.map((r) => r.recordId).join()}|${ignored.join()}`;
  useEffect(() => {
    if (focus && key !== '|') ref.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [key]);
  return (
    <div ref={ref}>
      {records.length > 0 && (
        <section className="afl-panel" aria-labelledby="afl-unmatched">
          <h2 id="afl-unmatched" tabIndex={-1}>
            Records not matched ({records.length})
          </h2>
          <ul className="afl-list">
            {records.map((r) => (
              <li key={r.recordId}>
                <span>{r.fileName}</span>
                <span className="afl-sub">
                  {r.match.kind === 'unmatched' && r.match.reason === 'noTemplate'
                    ? `No open template has its form ID, ${r.match.urn ?? ''}. Drop the form’s .xsn template too, and the record opens with it.`
                    : 'It does not say which InfoPath form made it.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {ignored.length > 0 && (
        <section className="afl-panel" aria-labelledby="afl-ignored">
          <h2 id="afl-ignored" tabIndex={-1}>
            Files not opened ({ignored.length})
          </h2>
          <ul className="afl-list">
            {ignored.map((f, i) => (
              <li key={`${f}-${i}`}>
                <span>{f}</span>
                <span className="afl-sub">
                  {/ › .*\.zip$/i.test(f)
                    ? 'A .zip inside a .zip is not opened. Drop it on its own.'
                    : 'Not a .xsn template, an .xml record or a .zip of them.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
