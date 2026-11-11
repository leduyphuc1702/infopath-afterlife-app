// Spec 12 R5.1, R5.2: "Export plan": the CSV (made in the Worker, saved through a `blob:` URL,
// so nothing is fetched or sent) and the one-page print view (`PrintPlan`, `window.print()`).
import { useMenu } from '../shell/menu';

interface Props {
  /** Resolves with the CSV text, or undefined when the Worker could not make it. */
  readonly onCsv: () => Promise<string | undefined>;
  /** Spec 15 R3.3: the dossier of every triaged form, as a `.zip` of Markdown. */
  readonly onDocumentation: () => void;
}

export function ExportMenu({ onCsv, onDocumentation }: Props) {
  const { ref, close } = useMenu();
  const csv = async () => {
    close();
    const text = await onCsv();
    if (text === undefined) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'afterlife-migration-plan.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details className="afl-menu afl-export" ref={ref}>
      <summary className="afl-button">Export plan</summary>
      <ul>
        <li>
          <button type="button" onClick={() => void csv()}>
            CSV
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => {
              close();
              window.print();
            }}
          >
            Print plan
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => {
              close();
              onDocumentation();
            }}
          >
            Download documentation
          </button>
        </li>
      </ul>
    </details>
  );
}
