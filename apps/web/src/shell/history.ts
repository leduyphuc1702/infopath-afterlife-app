// Spec 13 B2: each screen change (form, Triage, certificate) is one browser history entry, so
// Back and Forward move between screens and the session stays. The URL never changes.
import type { Place, State } from '../store';

export type HistoryLike = Pick<History, 'state' | 'pushState' | 'replaceState'>;

const KEY = 'afterlife';

export const placeOf = (s: State): Place => ({
  screen: s.screen,
  ...(s.openId !== undefined && { openId: s.openId }),
  ...(s.certificateId !== undefined && { certificateId: s.certificateId }),
});

/** Triage is one place whatever form is open behind it; a certificate is its form's. */
export const keyOf = (p: Place) =>
  p.screen === 'form'
    ? `form:${p.openId ?? ''}`
    : p.screen === 'certificate'
      ? `certificate:${p.certificateId ?? ''}`
      : p.screen === 'documentation'
        ? `documentation:${p.openId ?? ''}`
        : p.screen === 'records'
          ? `records:${p.openId ?? ''}`
          : 'triage';

export function placeIn(state: unknown): Place | undefined {
  const p = (state as Record<string, unknown> | null)?.[KEY] as Place | undefined;
  return p && typeof p.screen === 'string' ? p : undefined;
}

/**
 * Records `place` as the current entry. The same place (Back or Forward just restored it) adds
 * nothing. Spec 25 L2: the first place is an entry after the page's own (the start page), so Back
 * from it returns there; spec 13 B2 replaced the page's entry, and Back left the app.
 */
export function visit(h: HistoryLike, place: Place): void {
  const current = placeIn(h.state);
  if (current && keyOf(current) === keyOf(place)) return;
  const data = { [KEY]: place };
  h.pushState(data, '');
}
