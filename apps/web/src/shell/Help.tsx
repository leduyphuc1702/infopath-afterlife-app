import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** The button's name, for example "About this page". */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * An explanation behind a help icon. It shows while the pointer is on the icon or on the
 * explanation, and while the icon has focus; Escape hides it (WCAG 1.4.13). A screen reader
 * hears it as the button's description.
 * Not written by Kiro (README, "What Kiro did not write").
 */
export function Help({ label, children }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const leaving = useRef<number | undefined>(undefined);
  const show = () => {
    clearTimeout(leaving.current);
    setOpen(true);
  };
  // The pointer may cross the gap between the icon and the explanation.
  const hideSoon = () => {
    clearTimeout(leaving.current);
    leaving.current = window.setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => clearTimeout(leaving.current), []);
  return (
    <span className="afl-help" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        type="button"
        className="afl-help-b"
        data-icon="help"
        aria-label={label}
        aria-describedby={id}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      <span role="tooltip" id={id} className="afl-tip" hidden={!open}>
        {children}
      </span>
    </span>
  );
}
