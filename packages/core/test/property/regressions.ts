// Counterexamples found by the properties, shrunk by fast-check, replayed on every run (design
// §13.3, R19.3). Add an entry with the bug it found; never delete one.

import type { P1Input } from './p1-inputs';
import type { P12Input } from './p12-inputs';

export interface P1Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P1Input;
}

export const P1_REGRESSIONS: readonly P1Regression[] = [];

export interface P12Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P12Input;
}

export const P12_REGRESSIONS: readonly P12Regression[] = [];
