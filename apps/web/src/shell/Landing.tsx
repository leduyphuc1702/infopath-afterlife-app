import sampleList from 'virtual:sample-list';
import { Help } from './Help';
import { sampleDetail, sampleName } from './sample-names';
import { TASKS, type Task, type TaskId } from './tasks';

interface Props {
  readonly onSample: (id: string) => void;
  /** Spec 12 R4.5. */
  readonly onTriageAll: () => void;
  /** Spec 21 R1. */
  readonly onTask: (task: Task) => void;
}

const tryList = sampleList.filter((s) => !s.triageOnly);

/** A task card: an icon and a few words. The task's full sentence is its hover text. */
const CARDS: Readonly<Record<TaskId, readonly [icon: string, words: string]>> = {
  read: ['eye', 'Read forms and records'],
  rules: ['bolt', 'See the rules behind a field'],
  fill: ['pencil', 'Fill in a form'],
  find: ['search', 'Find and total records'],
  keep: ['archive', 'Keep records readable'],
  document: ['print', 'Print what a form does'],
  triage: ['waves', 'Decide which forms move first'],
};

export function Landing({ onSample, onTriageAll, onTask }: Props) {
  return (
    <section className="afl-landing" aria-labelledby="afl-tasks-h">
      <p className="afl-lead">
        Open InfoPath forms in your browser, as InfoPath drew{' '}
        <span className="afl-keep">
          them.
          <Help label="About InfoPath Afterlife">
            Microsoft removed InfoPath Forms Services from SharePoint Online after July 14, 2026.
            Here you can open InfoPath forms and their filled-in records, and fill them in again
            with their rules working. Find and total the records, export them or keep them as web
            pages, print what each form does, and see which forms can move to Jira Service
            Management first.
          </Help>
        </span>
      </p>
      <div className="afl-dropzone" data-icon="upload">
        <p className="afl-drop">
          Drop your InfoPath files anywhere on this{' '}
          <span className="afl-keep">
            page
            <Help label="Which files">
              Drop .xsn templates and .xml records anywhere on this page, a whole folder, or a .zip
              of them.
            </Help>
          </span>
        </p>
        <button
          type="button"
          className="afl-button afl-primary"
          data-icon="folder"
          onClick={() => document.querySelector<HTMLInputElement>('[data-afl-picker]')?.click()}
        >
          Choose files
        </button>
        <p className="afl-note" data-icon="lock">
          Nothing is uploaded. Your files never leave this computer.
        </p>
      </div>
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
              title={t.label}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onTask(t);
              }}
            >
              {CARDS[t.id][1]}
            </a>
          </li>
        ))}
      </ul>
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
    </section>
  );
}
