// Spec 04 task 10 (R4.2, R4.3): a rule's message box, as InfoPath showed it: modal, one OK
// button with focus, Escape closes, and focus goes back to what opened it.
import { useEffect, useRef } from 'react';

interface Props {
  /** The messages to show, one after another. */
  readonly messages: readonly string[];
  readonly onDone: () => void;
}

/** The focused element, looking into shadow roots (the paper's button lives in one). */
function deepActive(): HTMLElement | null {
  let a = document.activeElement as HTMLElement | null;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement as HTMLElement;
  return a;
}

export function RuleDialog({ messages, onDone }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = messages.length > 0;
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) {
      opener.current = deepActive();
      d.showModal();
    }
  }, [open]);
  const close = () => {
    ref.current?.close();
  };
  return (
    <dialog
      ref={ref}
      className="afl-dialog"
      aria-labelledby="afl-rule-dialog-title"
      aria-describedby="afl-rule-dialog-text"
      onClose={() => {
        const o = opener.current;
        opener.current = null;
        onDone();
        if (o?.isConnected) o.focus();
      }}
    >
      <h2 id="afl-rule-dialog-title">Message from the form</h2>
      <div id="afl-rule-dialog-text">
        {messages.map((m, i) => (
          <p key={i}>{m}</p>
        ))}
      </div>
      <div className="afl-dialog-actions">
        <button type="button" className="afl-button afl-primary" autoFocus onClick={close}>
          OK
        </button>
      </div>
    </dialog>
  );
}
