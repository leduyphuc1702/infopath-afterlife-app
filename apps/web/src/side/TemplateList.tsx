import type { TemplateSummary } from '../worker/protocol';

interface Props {
  readonly templates: readonly TemplateSummary[];
  readonly openId: string | undefined;
  readonly recordsOf: (templateId: string) => number;
  readonly onOpen: (templateId: string) => void;
}

/** R1.3: the phase A list of open templates (spec 12's Triage table replaces it). */
export function TemplateList({ templates, openId, recordsOf, onOpen }: Props) {
  return (
    <section className="afl-panel" aria-labelledby="afl-templates">
      <h2 id="afl-templates">Templates ({templates.length})</h2>
      <table className="afl-table">
        <thead>
          <tr>
            <th scope="col">Form</th>
            <th scope="col">Version</th>
            <th scope="col">Views</th>
            <th scope="col">Records</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.templateId} aria-current={t.templateId === openId ? 'true' : undefined}>
              <td>
                <button type="button" className="afl-link" onClick={() => onOpen(t.templateId)}>
                  {t.ir.meta.name}
                </button>
                <div className="afl-sub">{t.fileName}</div>
              </td>
              <td>{t.ir.meta.solutionVersion ?? '—'}</td>
              <td>{t.ir.views.length}</td>
              <td>{recordsOf(t.templateId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
