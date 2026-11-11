// Spec 04 task 11 (R9.1, R9.2): the "Rule Trace" tab. Newest entry first; each is a sentence,
// with the expression behind "Show expression". Hovering or focusing an entry outlines its field.
import type { FormIR, TraceEntry } from '@afterlife/core';
import { useMemo, useState } from 'react';
import { fieldName, traceExpression, tracePaths, traceSentence } from './trace-words';

interface Props {
  readonly ir: FormIR;
  readonly entries: readonly TraceEntry[];
  readonly onOutline: (path: string | undefined) => void;
}

const time = (at: string) => /T(\d\d:\d\d:\d\d)/.exec(at)?.[1] ?? at;

export function RuleTrace({ ir, entries, onOutline }: Props) {
  const [field, setField] = useState('');
  const fields = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) for (const p of tracePaths(e)) seen.set(p, fieldName(ir, p));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ir, entries]);
  const shown = entries.filter((e) => field === '' || tracePaths(e).includes(field)).reverse();
  if (entries.length === 0)
    return (
      <p className="afl-trace-empty">
        Each rule, calculation and check that runs while you fill in the form appears here, with why
        it ran. Change a field or press a button in the form to see it.
      </p>
    );
  return (
    <div className="afl-trace">
      <label className="afl-field">
        Show
        <select value={field} onChange={(e) => setField(e.target.value)}>
          <option value="">All fields</option>
          {fields.map(([p, label]) => (
            <option key={p} value={p}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="afl-trace-count">
        {shown.length === entries.length
          ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}, newest first.`
          : `${shown.length} of ${entries.length} entries, newest first.`}
        {entries.length >= 500 && ' Only the last 500 are kept.'}
      </p>
      <ol className="afl-trace-list" aria-label="Rule Trace entries">
        {shown.map((e) => {
          const path = tracePaths(e)[0];
          const expression = traceExpression(e);
          return (
            <li
              key={e.seq}
              className="afl-trace-entry"
              data-kind={e.kind}
              tabIndex={0}
              onMouseEnter={() => onOutline(path)}
              onMouseLeave={() => onOutline(undefined)}
              onFocus={() => onOutline(path)}
              onBlur={() => onOutline(undefined)}
            >
              <time dateTime={e.at}>{time(e.at)}</time> <span>{traceSentence(ir, e)}</span>
              {expression !== undefined && (
                <details>
                  <summary>Show expression</summary>
                  <code>{expression}</code>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
