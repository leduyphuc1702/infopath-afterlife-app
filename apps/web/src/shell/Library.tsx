// The first screen: the library. The forms this browser keeps, each with its records and the
// ways to open, fill in, back up and remove it; under them, the tasks and samples to learn with.
// Not written by Kiro (README, "What Kiro did not write").
import { useMemo, useState } from 'react';
import sampleList from 'virtual:sample-list';
import type { RecordSummary, TemplateSummary } from '../worker/protocol';
import { Help } from './Help';
import { sampleDetail, sampleName } from './sample-names';
import { TASKS, type Task, type TaskId } from './tasks';

interface Props {
  readonly templates: readonly TemplateSummary[];
  readonly records: readonly RecordSummary[];
  /** False until what an earlier visit kept has been read. */
  readonly ready: boolean;
  /** Whether this browser keeps the library between visits. */
  readonly kept: boolean;
  readonly onOpen: (templateId: string) => void;
  readonly onNew: (templateId: string) => void;
  readonly onRecords: (templateId: string) => void;
  readonly onRemove: (templateIds: readonly string[]) => void;
  readonly onBackup: () => void;
  readonly onSample: (id: string) => void;
  /** Spec 12 R4.5. */
  readonly onTriageAll: () => void;
  /** Spec 21 R1. */
  readonly onTask: (task: Task) => void;
}

const tryList = sampleList.filter((s) => !s.triageOnly);

/** A task: an icon, a few words, and one line on what the person gets. */
const CARDS: Readonly<Record<TaskId, readonly [icon: string, words: string, more: string]>> = {
  read: ['eye', 'Read forms and records', 'Every view and record, the way InfoPath showed it'],
  rules: [
    'bolt',
    'See the rules behind a field',
    'Its rules, its sums, where its value comes from',
  ],
  fill: ['pencil', 'Fill in a form', 'Rules run as you type, and Rule Trace says why'],
  find: ['search', 'Find and total records', 'Search every record, then total by any field'],
  keep: ['archive', 'Keep records readable', 'Excel, CSV, or web pages that need no InfoPath'],
  document: ['print', 'Print what a form does', 'Fields, rules and connections, on paper'],
  triage: [
    'waves',
    'Decide which forms move first',
    'All your forms in one table, sorted into waves, with what stops each one',
  ],
};

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pick = () => document.querySelector<HTMLInputElement>('[data-afl-picker]')?.click();
/** Above this many forms the table gets a box to find one in. */
const FIND_FROM = 9;

export function Library({
  templates,
  records,
  ready,
  kept,
  onOpen,
  onNew,
  onRecords,
  onRemove,
  onBackup,
  onSample,
  onTriageAll,
  onTask,
}: Props) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const of = new Map<string, { n: number; last: number }>();
    for (const r of records) {
      if (r.match.kind === 'unmatched') continue;
      const row = of.get(r.match.templateId) ?? { n: 0, last: 0 };
      of.set(r.match.templateId, { n: row.n + 1, last: Math.max(row.last, r.at ?? 0) });
    }
    return templates.map((t) => {
      const mine = of.get(t.templateId) ?? { n: 0, last: 0 };
      return { t, records: mine.n, last: Math.max(mine.last, t.at ?? 0) };
    });
  }, [templates, records]);
  const q = query.trim().toLowerCase();
  const shown =
    q === ''
      ? rows
      : rows.filter(({ t }) => `${t.ir.meta.name}\n${t.fileName}`.toLowerCase().includes(q));
  const samples = templates.filter((t) => t.sample).map((t) => t.templateId);
  const empty = templates.length === 0;

  return (
    <section className="afl-landing" aria-labelledby="afl-library-h">
      <div className="afl-lib-head">
        <h2 id="afl-library-h" tabIndex={-1}>
          Your library
        </h2>
        {!empty && (
          <div className="afl-lib-tools">
            <button type="button" className="afl-button" data-icon="download" onClick={onBackup}>
              Back up
            </button>
            <button
              type="button"
              className="afl-button afl-primary"
              data-icon="plus"
              onClick={pick}
            >
              Add files
            </button>
          </div>
        )}
      </div>
      {!ready ? (
        <p className="afl-lead">Reading your library…</p>
      ) : empty ? (
        <p className="afl-lead">
          Keep the InfoPath forms you still need: open them, fill in new records and save them{' '}
          <span className="afl-keep">
            here.
            <Help label="About InfoPath Afterlife">
              Microsoft removed InfoPath Forms Services from SharePoint Online after July 14, 2026.
              This is a home for the forms it left behind. Add .xsn forms and their .xml records,
              read them as InfoPath drew them, and fill in new records with the rules running. Find
              and total the records, export them, print what each form does, and see which forms can
              move to Jira Service Management first.
            </Help>
          </span>
        </p>
      ) : (
        <p className="afl-lead">
          {count(templates.length, 'form', 'forms')} and{' '}
          {count(records.length, 'record', 'records')},{' '}
          <span className="afl-keep">
            {kept ? 'kept in this browser.' : 'until this tab closes.'}
            <Help label="About the library">
              {kept
                ? 'The library is stored by this browser, on this computer. Nothing is uploaded. Clearing this site’s data in the browser removes it, so choose Back up now and then: it saves one .zip with every form and record, and dropping that .zip on this page brings them all back.'
                : 'This browser is not storing the library, as in some private windows. Choose Back up before you close the tab: it saves one .zip with every form and record, and dropping that .zip on this page brings them all back.'}
            </Help>
          </span>
        </p>
      )}
      {ready && empty && (
        <div className="afl-dropzone" data-icon="upload">
          <p className="afl-drop">
            Drop .xsn forms and .xml records anywhere on this{' '}
            <span className="afl-keep">
              page
              <Help label="Which files">
                Drop .xsn templates and .xml records anywhere on this page, a whole folder, or a
                .zip of them.
              </Help>
            </span>
          </p>
          <div className="afl-cta">
            <button
              type="button"
              className="afl-button afl-primary"
              data-icon="folder"
              onClick={pick}
            >
              Choose files
            </button>
            <button
              type="button"
              className="afl-button"
              data-icon="eye"
              onClick={() => onTask(TASKS[0]!)}
            >
              See a sample form
            </button>
          </div>
          <p className="afl-note" data-icon="lock">
            Nothing is uploaded. The library stays in this browser, on this computer.
          </p>
        </div>
      )}
      {!empty && (
        <>
          {rows.length >= FIND_FROM && (
            <label className="afl-lib-find" data-icon="search">
              <span className="afl-hidden">Find a form</span>
              <input
                type="search"
                placeholder="Find a form"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          )}
          <div className="afl-lib-box">
            {/* The roles are the table's own: they keep it a table to a screen reader when a
                narrow window lays each row out as a block. */}
            <table className="afl-lib-table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Form
                  </th>
                  <th scope="col" role="columnheader">
                    Records
                  </th>
                  <th scope="col" role="columnheader">
                    Last change
                  </th>
                  <th scope="col" role="columnheader">
                    <span className="afl-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {shown.map(({ t, records: n, last }) => {
                  const name = t.ir.meta.name;
                  const version = t.ir.meta.solutionVersion;
                  return (
                    <tr key={t.templateId} role="row">
                      <th scope="row" role="rowheader">
                        <button
                          type="button"
                          className="afl-link afl-lib-name"
                          onClick={() => onOpen(t.templateId)}
                        >
                          {name}
                        </button>
                        {t.sample && <span className="afl-lib-tag">Sample</span>}
                        <span className="afl-sub">
                          {t.fileName}
                          {version !== undefined && `, version ${version}`}
                        </span>
                      </th>
                      <td role="cell">
                        {n > 0 ? (
                          <button
                            type="button"
                            className="afl-link"
                            aria-label={`${count(n, 'record', 'records')} of ${name}`}
                            onClick={() => onRecords(t.templateId)}
                          >
                            {count(n, 'record', 'records')}
                          </button>
                        ) : (
                          <span className="afl-sub">None yet</span>
                        )}
                      </td>
                      <td role="cell" className="afl-lib-when">
                        {last > 0 && (
                          <time dateTime={new Date(last).toISOString()}>{WHEN.format(last)}</time>
                        )}
                      </td>
                      <td role="cell" className="afl-lib-actions">
                        <div>
                          <button
                            type="button"
                            className="afl-button"
                            data-icon="plus"
                            aria-label={`New record in ${name}`}
                            onClick={() => onNew(t.templateId)}
                          >
                            New record
                          </button>
                          <button
                            type="button"
                            className="afl-button afl-icon-b"
                            data-icon="trash"
                            title="Remove"
                            aria-label={`Remove ${name}`}
                            onClick={() => onRemove([t.templateId])}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 && <p className="afl-lib-none">No form has “{query.trim()}”.</p>}
          </div>
          {samples.length > 0 && (
            <div className="afl-lib-after">
              <button type="button" className="afl-link" onClick={() => onRemove(samples)}>
                Remove the {count(samples.length, 'sample form', 'sample forms')}
              </button>
            </div>
          )}
        </>
      )}
      <h2 id="afl-tasks-h" tabIndex={-1}>
        Start with a task
      </h2>
      <ul className="afl-tasks">
        {TASKS.map((t) => (
          <li key={t.id}>
            {/* R5: a real link, so the address can be copied or opened in a new tab. */}
            <a
              href={`#${t.id}`}
              data-icon={CARDS[t.id][0]}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onTask(t);
              }}
            >
              <b>{CARDS[t.id][1]}</b>
              <span>{CARDS[t.id][2]}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="afl-try">
        <h2 id="afl-try">Try a sample</h2>
        <ul className="afl-samples">
          {tryList.map((s) => {
            const detail = sampleDetail(s.id, s.records);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onSample(s.id)}>
                  {sampleName(s.id)}
                  {detail !== '' && <span className="afl-count">{detail}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="afl-triage-all">
          <button type="button" className="afl-button" data-icon="table" onClick={onTriageAll}>
            Triage all samples
          </button>
          <Help label="What this does">
            {sampleList.length} sample forms in one table: which can move today, and what stops the
            others.
          </Help>
        </div>
      </div>
    </section>
  );
}
