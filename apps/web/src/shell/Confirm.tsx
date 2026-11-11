// Spec 04 R6.4, D24: a real modal `<dialog>` that asks before work is lost. Escape or "Keep
// filling" keeps it; focus starts on the safe choice.
import { useCallback, useRef, useState } from 'react';

export interface Question {
  readonly title: string;
  readonly body: string;
  readonly yes: string;
  readonly no: string;
}

export function useConfirm(): [JSX.Element, (q: Question) => Promise<boolean>] {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState<Question>();
  const answer = useRef<(yes: boolean) => void>(undefined);
  // Spec 22 S6: what had focus before the question, inside the paper's shadow root too.
  const before = useRef<HTMLElement | null>(null);
  const ask = useCallback(
    (question: Question) =>
      new Promise<boolean>((resolve) => {
        answer.current = resolve;
        let a = document.activeElement;
        while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        before.current = a instanceof HTMLElement ? a : null;
        setQ(question);
        requestAnimationFrame(() => ref.current?.showModal());
      }),
    [],
  );
  const close = (yes: boolean) => {
    ref.current?.close();
    // "Keep filling": back to the field or control the person was on.
    if (!yes && before.current?.isConnected) before.current.focus();
    before.current = null;
    answer.current?.(yes);
    answer.current = undefined;
  };
  const element = (
    <dialog
      ref={ref}
      className="afl-dialog"
      aria-labelledby="afl-confirm-h"
      aria-describedby="afl-confirm-p"
      onCancel={(e) => {
        e.preventDefault();
        close(false);
      }}
    >
      <h2 id="afl-confirm-h">{q?.title}</h2>
      <p id="afl-confirm-p">{q?.body}</p>
      <div className="afl-dialog-actions">
        <button type="button" className="afl-button" autoFocus onClick={() => close(false)}>
          {q?.no}
        </button>
        <button type="button" className="afl-button afl-danger" onClick={() => close(true)}>
          {q?.yes}
        </button>
      </div>
    </dialog>
  );
  return [element, ask];
}

export const DISCARD = {
  title: 'Discard your changes?',
  body: "You changed this form and haven't downloaded the XML. Nothing is saved in the viewer, so the changes will be lost.",
  yes: 'Discard changes',
  no: 'Keep filling',
} as const;
