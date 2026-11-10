// Spec 12 R3.3, P8: the wave is a function of the four coverage counts alone (the brief's rules).
import type { CoverageClass } from '../coverage/table';

export type Wave = 1 | 2 | 3;

export function waveOf(c: Readonly<Record<CoverageClass, number>>): Wave {
  if (c.manual > 0 || c.unsupported > 0) return 3;
  if (c.emulated > 0) return 2;
  return 1;
}

/** The rules in plain words, for the Wave tooltip and the print view (R4.2, R5.2). */
export const WAVE_RULES: Readonly<Record<Wave, string>> = {
  1: 'Wave 1: everything converts to native Jira Service Management features.',
  2: 'Wave 2: some parts are emulated by Afterlife (Classic mode); nothing is manual or unsupported.',
  3: 'Wave 3: at least one part is manual or unsupported.',
};
