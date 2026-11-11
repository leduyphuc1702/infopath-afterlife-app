import { expect, test } from 'vitest';
// Test-only deep import: the runtime list of core's codes is not public API.
import { ERROR_CODES } from '../../../packages/core/src/errors';
import { MESSAGES, messageOf } from '../src/messages';

// R1.2, ux-principles.md 5: every core error code and every app code has a three-part message.
const APP = [
  'FILE_TOO_LARGE',
  'TOO_MANY_FILES',
  'WORKER_TIMEOUT',
  'WORKER_FAILED',
  // Spec 04 R1.4, R1.5.
  'FILL_PATH',
  'FILL_STATE',
];

test('the messages cover exactly the core codes and the app codes', () => {
  expect(Object.keys(MESSAGES).sort()).toEqual([...ERROR_CODES, ...APP].sort());
});

test.each(Object.keys(MESSAGES))(
  '%s has three non-empty parts, with and without details',
  (code) => {
    for (const details of [{}, { view: 'View 1', max: 10, observed: 11, line: 3, column: 4 }]) {
      const m = messageOf({ code: code as keyof typeof MESSAGES, details }, 'form.xsn');
      for (const part of [m.what, m.why, m.action]) {
        expect(part.trim().length).toBeGreaterThan(5);
        expect(part).not.toMatch(/undefined|null|\[object/);
      }
    }
  },
);
