// Catches the AfterlifeError a call throws (or a promise rejects with), so tests can match its
// code and details with `toMatchObject`. Anything else, or no error, fails the test.

import { AfterlifeError } from '../../src/errors';

export function catchError(fn: () => unknown): AfterlifeError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AfterlifeError) return e as AfterlifeError;
    throw new Error(`expected an AfterlifeError, got ${String(e)}`, { cause: e });
  }
  throw new Error('expected an AfterlifeError, but nothing was thrown');
}

export async function catchRejection(promise: Promise<unknown>): Promise<AfterlifeError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof AfterlifeError) return e as AfterlifeError;
    throw new Error(`expected an AfterlifeError, got ${String(e)}`, { cause: e });
  }
  throw new Error('expected an AfterlifeError, but the promise resolved');
}
