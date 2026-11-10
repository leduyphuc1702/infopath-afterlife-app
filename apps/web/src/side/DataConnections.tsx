// Spec 09 R6.1: every data connection, what it reaches, whether it survives the move, and what
// uses it. A field or control in an entry selects its field in the tree.
import { useEffect, useMemo, useRef } from 'react';
import type { FormIR } from '@afterlife/core';
import { connectionsOf, type ConnUse } from './connections';

interface Props {
  readonly ir: FormIR;
  /** The entry to bring into view (opened from the details card). */
  readonly current: string | undefined;
  readonly onField: (fieldId: string) => void;
}

export function DataConnections({ ir, current, onField }: Props) {
  const entries = useMemo(() => connectionsOf(ir), [ir]);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (current === undefined) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-conn="${CSS.escape(current)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    el.focus({ preventScroll: true });
  }, [current]);

  if (entries.length === 0) return <p className="afl-sub">This form has no data connections.</p>;

  const uses = (title: string, items: readonly ConnUse[]) =>
    items.length > 0 && (
      <>
        <h4>{title}</h4>
        <ul className="afl-list">
          {items.map((u) => (
            <li key={u.id}>
              {u.fieldId === undefined ? (
                <span>{u.label}</span>
              ) : (
                <button type="button" className="afl-link" onClick={() => onField(u.fieldId!)}>
                  {u.label}
                </button>
              )}
              <span className="afl-sub">{u.kind}</span>
            </li>
          ))}
        </ul>
      </>
    );

  return (
    <div className="afl-conns" ref={list}>
      {entries.map((c, i) => (
        <article
          key={c.id}
          className="afl-conn"
          data-conn={c.id}
          aria-current={c.id === current ? 'true' : undefined}
          aria-labelledby={`afl-conn-${i}`}
          tabIndex={-1}
        >
          <h3 id={`afl-conn-${i}`}>{c.name}</h3>
          <p className="afl-conn-facts">
            <span className="afl-chip">{c.kind}</span>
            <span className="afl-chip">{c.direction}</span>
            <span
              className={`afl-conn-status ${c.status === 'Works offline' ? 'afl-ok' : 'afl-dead'}`}
            >
              {c.status}
            </span>
          </p>
          {c.reasons.length > 0 && <p className="afl-sub">Why: {c.reasons.join('; ')}.</p>}
          {c.targets.length > 0 && (
            <ul className="afl-conn-targets">
              {c.targets.map((t) => (
                <li key={t.attribute + t.value}>
                  <span className="afl-sub">{t.attribute}</span>
                  <code className="afl-expr">{t.value}</code>
                </li>
              ))}
            </ul>
          )}
          {c.credentialRedacted && (
            <p className="afl-sub">A password in the connection string was removed.</p>
          )}
          {uses('Fills', c.fills)}
          {uses('Used by', c.usedBy)}
        </article>
      ))}
    </div>
  );
}
