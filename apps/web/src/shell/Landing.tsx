import sampleList from 'virtual:sample-list';
import { recordCount, sampleName } from './sample-names';

export function Landing({ onSample }: { readonly onSample: (id: string) => void }) {
  return (
    <section className="afl-landing" aria-labelledby="afl-try">
      <p className="afl-lead">
        Open old InfoPath forms and their filled-in records in your browser, drawn the way InfoPath
        drew them.
      </p>
      <p className="afl-note">Nothing is uploaded. Your files never leave this computer.</p>
      <p className="afl-drop">
        Drop .xsn templates and .xml records anywhere on this page, or a whole folder.
      </p>
      <h2 id="afl-try">Try a sample</h2>
      <ul className="afl-samples">
        {sampleList.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onSample(s.id)}>
              {sampleName(s.id)}
              <span className="afl-count">{recordCount(s.records)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
