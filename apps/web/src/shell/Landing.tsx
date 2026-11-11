import sampleList from 'virtual:sample-list';
import { sampleDetail, sampleName } from './sample-names';
import { TASKS, type Task } from './tasks';

interface Props {
  readonly onSample: (id: string) => void;
  /** Spec 12 R4.5. */
  readonly onTriageAll: () => void;
  /** Spec 21 R1. */
  readonly onTask: (task: Task) => void;
}

const tryList = sampleList.filter((s) => !s.triageOnly);

export function Landing({ onSample, onTriageAll, onTask }: Props) {
  return (
    <section className="afl-landing" aria-labelledby="afl-tasks-h">
      <p className="afl-context">
        Microsoft removed InfoPath Forms Services from SharePoint Online after July 14, 2026.
      </p>
      <p className="afl-lead">
        Open InfoPath forms and their filled-in records in your browser, as InfoPath drew them, and
        fill them in again with their rules working.
      </p>
      <p className="afl-lead">
        Find and total the records, export them or keep them as web pages, print what each form
        does, and see which forms can move to Jira Service Management first.
      </p>
      <h2 id="afl-tasks-h" tabIndex={-1}>
        Start with a task
      </h2>
      <ul className="afl-tasks">
        {TASKS.map((t) => (
          <li key={t.id}>
            {/* R5: a real link, so the address can be copied or opened in a new tab. */}
            <a
              href={`#${t.id}`}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onTask(t);
              }}
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="afl-note">Nothing is uploaded. Your files never leave this computer.</p>
      <p className="afl-drop">
        Drop .xsn templates and .xml records anywhere on this page, a whole folder, or a .zip of
        them.
      </p>
      <div className="afl-triage-all">
        <button type="button" className="afl-button afl-primary" onClick={onTriageAll}>
          Triage all samples
        </button>
        <span className="afl-sub">
          {sampleList.length} sample forms in one table: which can move today, and what stops the
          others.
        </span>
      </div>
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
    </section>
  );
}
