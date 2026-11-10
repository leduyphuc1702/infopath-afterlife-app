// Counterexamples found by the properties, shrunk by fast-check, replayed on every run (design
// §13.3, R19.3). Add an entry with the bug it found; never delete one.

import type { P1Input } from './p1-inputs';
import type { P12Input } from './p12-inputs';
import type { P13Input } from './p13-inputs';
import type { FormIR } from '../../src/index';

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

export interface P6Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: FormIR;
}

export const P6_REGRESSIONS: readonly P6Regression[] = [];

export interface P13Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P13Input;
}

export const P13_REGRESSIONS: readonly P13Regression[] = [];
