// Spec 04 R5.3: "N fields need attention", with buttons that focus each invalid control in
// view order, as InfoPath's "Go to next error" did.
import { useRef } from 'react';

const invalidControls = () => [
  ...(document
    .querySelector('[data-afl-paper]')
    ?.shadowRoot?.querySelectorAll<HTMLElement>('.afl-invalid') ?? []),
];

export function Attention({ count }: { readonly count: number }) {
  const at = useRef(-1);
  const go = (step: 1 | -1) => {
    const list = invalidControls();
    if (list.length === 0) return;
    at.current = (at.current + step + list.length) % list.length;
    const el = list[at.current]!;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    el.focus({ preventScroll: true });
  };
  return (
    <div className="afl-attention" role="status">
      <span>
        {count} {count === 1 ? 'field needs' : 'fields need'} attention.
      </span>
      <button type="button" className="afl-button" onClick={() => go(-1)}>
        Previous error
      </button>
      <button type="button" className="afl-button" onClick={() => go(1)}>
        Next error
      </button>
    </div>
  );
}
