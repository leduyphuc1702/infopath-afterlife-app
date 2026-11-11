import { readFileSync } from 'node:fs';
import { buildFormIR, FillSession, parseXsn } from '@afterlife/core';
import { expect, test } from 'vitest';
import { fieldName, traceSentence } from '../src/side/trace-words';

// Spec 04 task 11 (R9.1): Rule Trace entries read as sentences, from a real session.

const OWN = new URL('../../../samples/own/', import.meta.url);
const NOW = '2026-11-11T09:00:00+07:00';

async function open(slug: string) {
  const t = await parseXsn(readFileSync(new URL(`xsn/${slug}.xsn`, OWN)));
  const ir = buildFormIR(t);
  return { ir, s: FillSession.open(t, ir, { now: NOW }) };
}

test('form 04: a quantity edit reads as the calculation chain, in order', async () => {
  const { ir, s } = await open('04-purchase-request');
  const L = '/my:purchaseRequest[1]/my:lines[1]/my:line[1]';
  s.edit(`${L}/my:unitPrice[1]`, '100');
  const a = s.edit(`${L}/my:quantity[1]`, '3');
  expect(a.trace.filter((e) => e.kind === 'calc').map((e) => traceSentence(ir, e))).toEqual([
    'Line total in row 1 changed from 0 to 300 because Qty in row 1 changed.',
    'Subtotal changed from 0 to 300 because Line total in row 1 changed.',
    expect.stringMatching(/^VAT changed from 0 to [\d.]+ because Subtotal changed\.$/),
    expect.stringMatching(/^Total incl\. VAT changed from 0 to [\d.]+ because Subtotal changed\.$/),
  ]);
});

test('form 03 rule, form 04 skipped query, and a validation, in words', async () => {
  const { ir, s } = await open('03-travel-request');
  const T = '/my:travelRequest[1]';
  s.edit(`${T}/my:destCity[1]`, 'Hanoi');
  const words = s.edit(`${T}/my:destCountry[1]`, 'VN').trace.map((e) => traceSentence(ir, e));
  expect(words[0]).toBe(
    `Rule “Clear city when country changes” ran because ${fieldName(ir, `${T}/my:destCountry[1]`)} changed: ${fieldName(ir, `${T}/my:destCity[1]`)} changed from Hanoi to blank.`,
  );
  const { ir: ir4, s: s4 } = await open('04-purchase-request');
  const skipped = s4
    .press('CTRL900')
    .trace.filter((e) => e.kind === 'skipped')
    .map((e) => traceSentence(ir4, e));
  expect(skipped).toContain(
    'Rule “Query budget service” did not query a data connection. Query connections are not available in the viewer.',
  );
});
