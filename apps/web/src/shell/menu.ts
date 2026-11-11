// Spec 13 B5: a `<details>` menu closes on Escape (focus goes back to its summary button) and on
// a click outside it.
import { useEffect, useRef } from 'react';

export function useMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !menu.open) return;
      e.preventDefault();
      menu.open = false;
      menu.querySelector('summary')?.focus();
    };
    const outside = (e: PointerEvent) => {
      if (menu.open && !menu.contains(e.target as Node)) menu.open = false;
    };
    menu.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    return () => {
      menu.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  return { ref, close: () => ref.current?.removeAttribute('open') };
}
