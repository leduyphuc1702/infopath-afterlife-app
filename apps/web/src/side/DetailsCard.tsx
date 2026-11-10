import type { Card } from './card';

interface Props {
  readonly card: Card;
  /** Opens the connection's entry in the "Data connections" tab. */
  readonly onConnection: (connectionId: string) => void;
}

/** R5.1: what a field is and what touches it. */
export function DetailsCard({ card, onConnection }: Props) {
  return (
    <section className="afl-panel afl-card" aria-labelledby="afl-card-title">
      <h2 id="afl-card-title">{card.label}</h2>
      <dl className="afl-facts">
        <dt>Path</dt>
        <dd>
          <code>{card.path}</code>
        </dd>
        <dt>Type</dt>
        <dd>{card.type}</dd>
        <dt>Required</dt>
        <dd>{card.required ? 'Yes' : 'No'}</dd>
        {card.repeating && (
          <>
            <dt>Repeating</dt>
            <dd>Yes</dd>
          </>
        )}
        <dt>Controls</dt>
        <dd>{card.controls === 0 ? 'Not shown in any view' : card.controls}</dd>
      </dl>
      <h3>Rules, calculations and validations</h3>
      {card.refs.length === 0 ? (
        <p className="afl-sub">None touch this field.</p>
      ) : (
        <ul className="afl-refs">
          {card.refs.map((r) => (
            <li key={r.id}>
              <span className="afl-chip">{r.kind}</span> {r.title}
              {r.expression !== undefined && <code className="afl-expr">{r.expression}</code>}
              {r.note !== undefined && <span className="afl-sub">{r.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <h3>Data connections</h3>
      {card.connections.length === 0 ? (
        <p className="afl-sub">None.</p>
      ) : (
        <ul className="afl-refs">
          {card.connections.map((c) => (
            <li key={c.id}>
              <button type="button" className="afl-link" onClick={() => onConnection(c.id)}>
                {c.name}
              </button>{' '}
              <span className="afl-sub">{c.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
