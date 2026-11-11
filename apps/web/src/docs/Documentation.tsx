// Spec 15 R1, R3.1–R3.3: the form dossier as a screen. React escapes every text, so a form's
// labels and messages stay text here; the Markdown escapes them itself (core).
import { useEffect } from 'react';
import type { Dossier, DossierItem } from '@afterlife/core';

interface Props {
  readonly dossier: Dossier;
  readonly onBack: () => void;
  readonly onDownload: () => void;
}

function Items({ items, none }: { readonly items: readonly DossierItem[]; readonly none: string }) {
  if (items.length === 0) return <p>{none}</p>;
  return (
    <ul className="afl-doc-items">
      {items.map((i, n) => (
        <li key={i.id ?? n}>
          {i.sentence}
          {i.expressions.map((e, k) => (
            <code key={k} className="afl-doc-expr">
              {e}
            </code>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function Documentation({ dossier: d, onBack, onDownload }: Props) {
  // The dossier arrives from the Worker after the screen changed; its heading takes focus then.
  useEffect(() => document.getElementById('afl-doc-h')?.focus({ preventScroll: true }), [d]);
  return (
    <article className="afl-doc" aria-labelledby="afl-doc-h">
      {/* Spec 16 K12: the heading first, so Tab from it reaches the screen's buttons. */}
      <h2 id="afl-doc-h" tabIndex={-1}>
        {d.name}: form documentation
      </h2>
      <div className="afl-doc-tools afl-no-print">
        <button type="button" className="afl-link" onClick={onBack}>
          Back
        </button>
        <button type="button" className="afl-button" onClick={onDownload}>
          Download Markdown
        </button>
        <button type="button" className="afl-button" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <section aria-labelledby="afl-doc-about">
        <h3 id="afl-doc-about">What the form is</h3>
        <dl className="afl-doc-about">
          {d.about.map((a) => (
            <div key={a.label}>
              <dt>{a.label}</dt>
              <dd>{a.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="afl-doc-fields">
        <h3 id="afl-doc-fields">Fields</h3>
        <table className="afl-doc-fields" aria-labelledby="afl-doc-fields">
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Path</th>
              <th scope="col">Type</th>
              <th scope="col">Required</th>
              <th scope="col">Default</th>
              <th scope="col">Views</th>
            </tr>
          </thead>
          <tbody>
            {d.fields.map((f) => (
              <tr key={f.path}>
                <th scope="row">{f.label}</th>
                {/* Spec 16 K1: on a narrow screen each row is a block; the labels name its parts. */}
                <td data-label="Path">
                  <code>{f.path}</code>
                </td>
                <td data-label="Type">{f.type}</td>
                <td data-label="Required">{f.required ? 'Yes' : 'No'}</td>
                <td data-label="Default">{f.default}</td>
                <td data-label="Views">{f.views.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="afl-doc-logic">
        <h3 id="afl-doc-logic">Logic</h3>
        <h4>When the form opens</h4>
        <Items items={d.logic.onOpen} none="Nothing runs when the form opens." />
        <h4>Rules</h4>
        <Items items={d.logic.rules} none="The form has no rules." />
        <h4>Calculations</h4>
        <Items items={d.logic.calculations} none="The form has no calculated fields." />
        <h4>Validations</h4>
        <Items items={d.logic.validations} none="The form has no validations." />
        <h4>Buttons</h4>
        <Items items={d.logic.buttons} none="No button runs rules." />
      </section>
      <section aria-labelledby="afl-doc-conn">
        <h3 id="afl-doc-conn">Data connections</h3>
        <Items items={d.connections} none="The form has no data connections." />
      </section>
      <section aria-labelledby="afl-doc-deps">
        <h3 id="afl-doc-deps">What depends on what</h3>
        <Items
          items={d.depends}
          none="No field feeds a calculation, rule, validation or choice list."
        />
      </section>
      <section aria-labelledby="afl-doc-unread">
        <h3 id="afl-doc-unread">What could not be read</h3>
        <Items items={d.unread} none="Everything in the template was read." />
      </section>
    </article>
  );
}
