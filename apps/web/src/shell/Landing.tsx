import sampleList from 'virtual:sample-list';
import { Help } from './Help';
import { sampleDetail, sampleName } from './sample-names';
import { TASKS, type Task, type TaskId } from './tasks';
import shotDark from './shot-dark.webp';
import shotLight from './shot-light.webp';

interface Props {
  readonly onSample: (id: string) => void;
  /** Spec 12 R4.5. */
  readonly onTriageAll: () => void;
  /** Spec 21 R1. */
  readonly onTask: (task: Task) => void;
}

const tryList = sampleList.filter((s) => !s.triageOnly);

/** A task card: an icon, a few words, and one line on what the person gets. */
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

/**
 * A picture of this app at work, taken from the build itself: the Purchase request sample in
 * Fill, after Qty was changed from 7 to 12, with Rule Trace open.
 */
const Preview = () => (
  <div className="afl-shot">
    <div className="afl-shot-bar" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
    <picture>
      <source srcSet={shotDark} media="(prefers-color-scheme: dark)" />
      <img
        src={shotLight}
        alt="The Purchase request sample being filled in. After Qty changed, Rule Trace lists why Line total, Subtotal, VAT and Total changed."
        width="1920"
        height="1200"
        decoding="async"
        // Offline, a picture that was never fetched leaves no broken frame behind.
        onError={(e) => e.currentTarget.closest('.afl-shot')?.setAttribute('hidden', '')}
      />
    </picture>
  </div>
);

export function Landing({ onSample, onTriageAll, onTask }: Props) {
  return (
    <section className="afl-landing" aria-labelledby="afl-tasks-h">
      <span className="afl-eyebrow">
        InfoPath Forms Services left SharePoint Online on July 14, 2026
      </span>
      <p className="afl-lead">
        InfoPath has retired. <em>Your forms</em>{' '}
        <span className="afl-keep">
          <em>haven’t.</em>
          <Help label="About InfoPath Afterlife">
            Microsoft removed InfoPath Forms Services from SharePoint Online after July 14, 2026.
            Here you can open InfoPath forms and their filled-in records, and fill them in again
            with their rules working. Find and total the records, export them or keep them as web
            pages, print what each form does, and see which forms can move to Jira Service
            Management first.
          </Help>
        </span>
      </p>
      <div className="afl-pitch">
        Open .xsn forms and their .xml records in your browser, drawn as InfoPath drew them, with
        their rules still running. Free and open source.
      </div>
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
        <div className="afl-cta">
          <button
            type="button"
            className="afl-button afl-primary"
            data-icon="folder"
            onClick={() => document.querySelector<HTMLInputElement>('[data-afl-picker]')?.click()}
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
          Nothing is uploaded. Your files never leave this computer.
        </p>
      </div>
      <ul className="afl-trust">
        <li data-icon="check">No account</li>
        <li data-icon="check">Works offline</li>
        <li data-icon="check">MIT open source</li>
      </ul>
      <Preview />
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
