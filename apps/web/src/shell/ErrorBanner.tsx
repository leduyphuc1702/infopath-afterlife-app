import { messageOf } from '../messages';
import type { Problem } from '../store';

/** R1.2: one three-part message per file that could not be opened. */
export function ErrorBanner({ problems }: { readonly problems: readonly Problem[] }) {
  if (problems.length === 0) return null;
  return (
    <section className="afl-problems" aria-label="Files that could not be opened">
      {problems.map((p, i) => {
        const m = messageOf(p.error, p.fileName);
        return (
          <div className="afl-problem" role="alert" key={`${p.fileName}-${i}`}>
            <strong>{m.what}</strong> <span>{m.why}</span> <span>{m.action}</span>
          </div>
        );
      })}
    </section>
  );
}
