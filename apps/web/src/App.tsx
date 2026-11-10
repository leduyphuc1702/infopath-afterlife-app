import { useEffect, useMemo, useRef, useState } from 'react';
import sampleList from 'virtual:sample-list';
import { Paper } from './paper/Paper';
import { localNow, WorkerClient } from './worker/client';
import type { RecordSummary, RenderedRes, TemplateSummary } from './worker/protocol';
import { loadPaperFonts } from './shell/fonts';

/** `02-expense-report` → `Expense report`; `theill-weight-keeper` → `Weight keeper`. */
const sampleName = (id: string) => {
  const words = id.replace(/^\d+-|^theill-/, '').replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

type Status =
  { state: 'idle' } | { state: 'loading'; what: string } | { state: 'error'; message: string };

interface Open {
  readonly template: TemplateSummary;
  /** Matched records, in file name order (R3.2). */
  readonly records: readonly RecordSummary[];
}

export function App() {
  const client = useMemo(() => new WorkerClient(), []);
  const [now] = useState(localNow);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [open, setOpen] = useState<Open>();
  const [recordIndex, setRecordIndex] = useState(0);
  const [result, setResult] = useState<RenderedRes>();
  const latest = useRef(0);

  useEffect(() => () => client.terminate(), [client]);

  const view =
    open && (open.template.ir.views.find((v) => v.isDefault) ?? open.template.ir.views[0]);
  const record = recordIndex === 0 ? undefined : open?.records[recordIndex - 1];

  useEffect(() => {
    if (!open || !view) return;
    const ticket = ++latest.current;
    void client.render(open.template.templateId, view.name, record?.recordId, now).then((r) => {
      if (ticket !== latest.current) return; // a newer request is on its way
      if (r.type === 'rendered') {
        setResult(r);
        setStatus({ state: 'idle' });
      } else setStatus({ state: 'error', message: describe(r) });
    });
  }, [client, now, open, view, record]);

  async function openSample(id: string) {
    setStatus({ state: 'loading', what: sampleName(id) });
    const [session] = await Promise.all([client.openSample(id), loadPaperFonts()]);
    if (session.type !== 'session')
      return setStatus({ state: 'error', message: describe(session) });
    const template = session.templates[0]!;
    const records = session.records.filter(
      (r) => r.match.kind !== 'unmatched' && r.match.templateId === template.templateId,
    );
    setResult(undefined);
    setRecordIndex(0);
    setOpen({ template, records });
  }

  const count = open ? open.records.length : 0;
  const position = record ? `Record ${recordIndex} of ${count}, ${record.fileName}` : 'Empty form';

  return (
    <>
      <header className="afl-header">
        <h1>InfoPath Afterlife</h1>
      </header>
      <main className="afl-main">
        <section className="afl-landing" aria-labelledby="afl-try">
          <p className="afl-lead">
            Open old InfoPath forms and their filled-in records in your browser, drawn the way
            InfoPath drew them.
          </p>
          <p className="afl-note">Nothing is uploaded. Your files never leave this computer.</p>
          <h2 id="afl-try">Try a sample</h2>
          <ul className="afl-samples">
            {sampleList.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => void openSample(s.id)}>
                  {sampleName(s.id)}
                  <span className="afl-count">
                    {s.records === 0
                      ? 'No records'
                      : s.records === 1
                        ? '1 record'
                        : `${s.records} records`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <div aria-live="polite" className="afl-status">
          {status.state === 'loading' && `Opening ${status.what}…`}
          {status.state === 'error' && status.message}
        </div>
        {open && view && (
          <nav className="afl-toolbar" aria-label="Records">
            <span className="afl-form-name">{open.template.ir.meta.name}</span>
            <span>{view.caption ?? view.name} view</span>
            <button
              type="button"
              disabled={recordIndex === 0}
              onClick={() => setRecordIndex((i) => i - 1)}
            >
              Previous
            </button>
            <span aria-live="polite">{position}</span>
            <button
              type="button"
              disabled={recordIndex >= count}
              onClick={() => setRecordIndex((i) => i + 1)}
            >
              Next
            </button>
          </nav>
        )}
        {open && view && result && (
          <Paper
            result={result}
            label={`${open.template.ir.meta.name}, ${view.caption ?? view.name} view, ${record ? record.fileName : 'empty form'}`}
          />
        )}
      </main>
    </>
  );
}

/** Task 4 replaces this with the three-part messages of messages.ts. */
const describe = (r: { type: string; error?: { code: string } }) =>
  `We couldn't open the form (${r.error?.code ?? r.type}).`;
