// Spec 04 R6.4, D24: a real modal `<dialog>` that asks before work is lost. Escape or "Keep
// filling" keeps it; focus starts on the safe choice.
import { useCallback, useRef, useState } from 'react';

interface Question {
  readonly title: string;
  readonly body: string;
  readonly yes: string;
  readonly no: string;
}

export function useConfirm(): [JSX.Element, (q: Question) => Promise<boolean>] {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState<Question>();
  const answer = useRef<(yes: boolean) => void>(undefined);
  const ask = useCallback(
    (question: Question) =>
      new Promise<boolean>((resolve) => {
        answer.current = resolve;
        setQ(question);
        requestAnimationFrame(() => ref.current?.showModal());
      }),
    [],
  );
  const close = (yes: boolean) => {
    ref.current?.close();
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
