// Spec 09 R9.3, design §5: the first time a template renders, the paper fades from sepia to
// clean in 1.2 s. Under `prefers-reduced-motion: reduce` no filter is ever set.
export const SEPIA = 'sepia(0.85) contrast(0.92)';
export const FADE_MS = 1200;

export function fadeIn(el: HTMLElement, win: Window = window): void {
  if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.style.transition = 'none';
  el.style.filter = SEPIA;
  // One frame with the sepia drawn, then the transition to none.
  win.requestAnimationFrame(() =>
    win.requestAnimationFrame(() => {
      el.style.transition = `filter ${FADE_MS}ms ease-out`;
      el.style.filter = 'none';
    }),
  );
  const done = () => {
    el.style.removeProperty('transition');
    el.style.removeProperty('filter');
  };
  win.setTimeout(done, FADE_MS + 200);
}
