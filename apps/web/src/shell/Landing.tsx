import sampleList from 'virtual:sample-list';
import { sampleDetail, sampleName } from './sample-names';

export function Landing({ onSample }: { readonly onSample: (id: string) => void }) {
  return (
    <section className="afl-landing" aria-labelledby="afl-try">
      <p className="afl-context">
        Microsoft retired InfoPath Forms Services in SharePoint Online on July 14, 2026.
      </p>
      <p className="afl-lead">
        Open a form and its filled-in records as InfoPath drew them, in your browser.
      </p>
      <p className="afl-lead">
        Turn on X-ray to see the rules, calculations and data connections behind each field.
      </p>
      <p className="afl-note">Nothing is uploaded. Your files never leave this computer.</p>
      <p className="afl-drop">
        Drop .xsn templates and .xml records anywhere on this page, or a whole folder.
      </p>
      <h2 id="afl-try">Try a sample</h2>
      <ul className="afl-samples">
        {sampleList.map((s) => {
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
