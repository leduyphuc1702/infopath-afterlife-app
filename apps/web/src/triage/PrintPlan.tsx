// Spec 12 R5.2: the plan on one page (A4 and Letter): totals, forms per wave, the five most
// common causes, and the wave rules in plain words. Hidden on screen; `triage.css` prints it
// alone. No time, effort or cost (R3.7).
import type { CauseId, TriageResult, TriageRow, Wave } from '@afterlife/core';
import { CAUSE_SHORT, CAUSE_TITLES, EMULATED_TOOLTIP, WAVE_RULES } from './words';

const WAVES: readonly Wave[] = [1, 2, 3];

export function PrintPlan({ result }: { readonly result: TriageResult }) {
  const { totals } = result;
  const forms = result.rows.filter((r): r is TriageRow => r.kind === 'form');
  const records = forms.reduce((n, r) => n + (r.records ?? 0), 0);
  const anyRecords = forms.some((r) => r.records !== undefined);
  const items = forms.reduce(
    (a, r) => ({
      native: a.native + r.coverage.native,
      emulated: a.emulated + r.coverage.emulated,
      manual: a.manual + r.coverage.manual,
      unsupported: a.unsupported + r.coverage.unsupported,
    }),
    { native: 0, emulated: 0, manual: 0, unsupported: 0 },
  );
  const top = (Object.entries(totals.causes) as [CauseId, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 5);
  return (
    <section className="afl-print" aria-hidden="true">
      <h1>Migration plan</h1>
      <p>
        {totals.forms} {totals.forms === 1 ? 'form' : 'forms'}
        {anyRecords && `, ${records} records`}
        {totals.errors > 0 && `, ${totals.errors} files that could not be opened`}. Elements: native{' '}
        {items.native}, emulated {items.emulated} ({EMULATED_TOOLTIP}), manual {items.manual},
        unsupported {items.unsupported}.
      </p>
      <h2>Forms per wave</h2>
      {WAVES.map((w) => {
        const names = forms.filter((r) => r.wave === w).map((r) => r.name);
        return (
          <p key={w}>
            <strong>
              Wave {w}: {names.length}
            </strong>
            {names.length > 0 && ` (${names.join(', ')})`}
          </p>
        );
      })}
      <h2>Most common causes of death</h2>
      <ol>
        {top.map(([id, n]) => (
          <li key={id}>
            {CAUSE_TITLES[id]} ({CAUSE_SHORT[id]}, {id}): {n} {n === 1 ? 'form' : 'forms'}
          </li>
        ))}
      </ol>
      <h2>How waves are assigned</h2>
      <ul>
        {WAVES.map((w) => (
          <li key={w}>{WAVE_RULES[w]}</li>
        ))}
      </ul>
      <p className="afl-print-foot">
        Made by InfoPath Afterlife in the browser, from the files alone. Workflows attached outside
        the forms cannot be detected from the files.
      </p>
    </section>
  );
}
