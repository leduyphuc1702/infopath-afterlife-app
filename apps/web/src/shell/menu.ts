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
    // Spec 13 B11: the list hangs from the summary's right edge; near the left of a narrow
    // screen it is shifted back inside the viewport (8 px from either edge).
    const place = () => {
      const list = menu.querySelector('ul');
      if (!list || !menu.open) return;
      list.style.transform = '';
      const r = list.getBoundingClientRect();
      const edge = 8;
      const shift =
        r.left < edge
          ? edge - r.left
          : r.right > innerWidth - edge
            ? innerWidth - edge - r.right
            : 0;
      if (shift !== 0) list.style.transform = `translateX(${Math.round(shift)}px)`;
    };
    menu.addEventListener('toggle', place);
    menu.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    return () => {
      menu.removeEventListener('toggle', place);
      menu.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  return { ref, close: () => ref.current?.removeAttribute('open') };
}
