import { CAUSE_IDS, EMULATED_TOOLTIP, WAVE_RULES, WORKFLOW_LINE } from '@afterlife/core';
import { expect, test } from 'vitest';
import * as words from '../src/triage/words';

// Spec 12: the app repeats core's user-facing strings (the main thread imports core types only);
// they must stay equal.
test("the app's Triage words equal core's", () => {
  expect(words.WAVE_RULES).toEqual(WAVE_RULES);
  expect(words.WORKFLOW_LINE).toBe(WORKFLOW_LINE);
  expect(words.EMULATED_TOOLTIP).toBe(EMULATED_TOOLTIP);
  expect(Object.keys(words.CAUSE_TITLES).sort()).toEqual([...CAUSE_IDS].sort());
  expect(Object.keys(words.CAUSE_SHORT).sort()).toEqual([...CAUSE_IDS].sort());
  expect(words.CAUSE_SHORT['infopath-client']).toBe('InfoPath 2013');
});

test('shortPath gives view XSL paths their usual prefixes', () => {
  expect(
    words.shortPath(
      '/{http://www.w3.org/1999/XSL/Transform}stylesheet[1]/div[1]/object[1]/@{http://schemas.microsoft.com/office/infopath/2003}server',
    ),
  ).toBe('/xsl:stylesheet[1]/div[1]/object[1]/@xd:server');
});
