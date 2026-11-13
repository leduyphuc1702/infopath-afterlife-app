import sampleList from 'virtual:sample-list';
import { TASKS, type Task } from './tasks';

interface Props {
  readonly onTask: (task: Task) => void;
}

const WITHOUT = [
  'An .xsn file opens in nothing',
  'A record is a page of raw XML',
  'Rules and calculations stay buried in the template',
  'Nobody can say which forms are safe to move',
];
const WITH = [
  'Every view opens in a browser, as it was drawn',
  'Each record reads the way the form showed it',
  'Every rule is listed, and traced while you type',
  'Triage sorts the forms into waves, with reasons',
];

const STEPS = [
  ['Drop your files', '.xsn templates, .xml records, a whole folder or a .zip of them.'],
  [
    'Read, fill in, find',
    'Page through records, fill in a form with its rules running, search and total.',
  ],
  [
    'Keep or move',
    'Export to Excel or CSV, keep web pages that open anywhere, print what each form does.',
  ],
] as const;

const PRIVATE = [
  ['lock', 'Nothing is uploaded', 'This page is not allowed to make a network request.'],
  ['bolt', 'Works offline', 'Once loaded, it runs with the network switched off.'],
  ['doc', 'Open source', 'MIT licence. Read the code, or run your own copy.'],
  ['eye', 'No account', 'Nothing to sign up for and nothing to install.'],
] as const;

const FAQ = [
  [
    'Do I need InfoPath installed?',
    'No. The app reads the .xsn template itself and draws its views in your browser.',
  ],
  [
    'Are my files uploaded anywhere?',
    'No. They are read on this computer. The page’s security policy forbids network requests, so it could not send them if it tried.',
  ],
  [
    'Which files can I open?',
    '.xsn templates and their .xml records: single files, a whole folder, or a .zip.',
  ],
  [
    'Can I still fill in a form?',
    'Yes. Switch on Fill: rules, calculations and validation run as you type, Rule Trace shows why each value changed, and the result downloads as XML.',
  ],
  [
    'What does not work?',
    'Code-behind and ActiveX controls do not run, and data connections are listed but never called. Triage names each of these, form by form.',
  ],
  [
    'How does it help me move to Jira Service Management?',
    'Open all your templates at once. Triage puts each form in a wave, and its death certificate says what stops it.',
  ],
  ['What does it cost?', 'Nothing. It is open source under the MIT licence.'],
] as const;

const records = sampleList.reduce((n, s) => n + s.records, 0);

/**
 * The first screen below its first view: what changed, how it works, privacy, questions.
 * Not written by Kiro (README, "What Kiro did not write").
 */
export function About({ onTask }: Props) {
  return (
    <div className="afl-about">
      <section className="afl-band afl-versus">
        <h2>The forms outlived the software</h2>
        <div className="afl-col">
          <h3>Without InfoPath</h3>
          <ul>
            {WITHOUT.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="afl-col afl-col-yes">
          <h3>With InfoPath Afterlife</h3>
          <ul>
            {WITH.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="afl-band" aria-labelledby="afl-how">
        <h2 id="afl-how">From a folder of files to a form on screen</h2>
        <ol className="afl-steps">
          {STEPS.map(([title, words]) => (
            <li key={title}>
              <b>{title}</b>
              <span>{words}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="afl-band afl-private" aria-labelledby="afl-private">
        <h2 id="afl-private">Your files never leave this computer</h2>
        <ul className="afl-grid">
          {PRIVATE.map(([icon, title, words]) => (
            <li key={title} data-icon={icon}>
              <b>{title}</b>
              <span>{words}</span>
            </li>
          ))}
        </ul>
        <dl className="afl-stats">
          {(
            [
              [sampleList.length, 'sample forms built in'],
              [records, 'filled-in sample records'],
              [TASKS.length, 'tasks, each one click away'],
              [0, 'files sent anywhere'],
            ] as const
          ).map(([n, words]) => (
            <div key={words}>
              <dt>{n}</dt>
              <dd>{words}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="afl-band" aria-labelledby="afl-faq">
        <h2 id="afl-faq">Questions people ask</h2>
        <div className="afl-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <div>{a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="afl-band afl-close">
        <h2>Open your first form</h2>
        <div className="afl-cta">
          <button
            type="button"
            className="afl-button afl-primary"
            data-icon="folder"
            onClick={() => document.querySelector<HTMLInputElement>('[data-afl-picker]')?.click()}
          >
            Open your forms
          </button>
          <button
            type="button"
            className="afl-button"
            data-icon="eye"
            onClick={() => onTask(TASKS[0]!)}
          >
            Start with a sample
          </button>
        </div>
      </section>
    </div>
  );
}
