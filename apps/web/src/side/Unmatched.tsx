import type { RecordSummary } from '../worker/protocol';

/** R2.2: records no open template made, each with its reason; and files that are not forms. */
export function Unmatched({
  records,
  ignored,
}: {
  readonly records: readonly RecordSummary[];
  readonly ignored: readonly string[];
}) {
  return (
    <>
      {records.length > 0 && (
        <section className="afl-panel" aria-labelledby="afl-unmatched">
          <h2 id="afl-unmatched">Records not matched ({records.length})</h2>
          <ul className="afl-list">
            {records.map((r) => (
              <li key={r.recordId}>
                <span>{r.fileName}</span>
                <span className="afl-sub">
                  {r.match.kind === 'unmatched' && r.match.reason === 'noTemplate'
                    ? `No open template has its form ID, ${r.match.urn ?? ''}.`
                    : 'It does not say which InfoPath form made it.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {ignored.length > 0 && (
        <section className="afl-panel" aria-labelledby="afl-ignored">
          <h2 id="afl-ignored">Files not opened ({ignored.length})</h2>
          <ul className="afl-list">
            {ignored.map((f, i) => (
              <li key={`${f}-${i}`}>
                <span>{f}</span>
                <span className="afl-sub">Not a .xsn template or an .xml record.</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
