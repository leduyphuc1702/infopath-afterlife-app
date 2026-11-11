import sampleList from 'virtual:sample-list';
import { sampleDetail, sampleName } from './sample-names';

interface Props {
  readonly onSample: (id: string) => void;
  /** Spec 12 R4.5. */
  readonly onTriageAll: () => void;
}

const tryList = sampleList.filter((s) => !s.triageOnly);

export function Landing({ onSample, onTriageAll }: Props) {
  return (
    <section className="afl-landing" aria-labelledby="afl-try">
      <p className="afl-context">
        Microsoft removed InfoPath Forms Services from SharePoint Online after July 14, 2026.
      </p>
      <p className="afl-lead">
        Open a form and its filled-in records as InfoPath drew them, in your browser.
      </p>
      <p className="afl-lead">
        Turn on X-ray to see the rules, calculations and data connections behind each field.
      </p>
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
