import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Session } from '../src/worker/session';

// Spec 04 task 13: open a record, turn Fill on, touch nothing, Download XML: the bytes that were
// opened. A record that opening itself changes (a calculated field stored empty, D13) cannot
// come back unchanged; those are listed with what opening wrote.

const OWN = new URL('../../../samples/own/', import.meta.url);
const NOW = '2026-11-11T09:00:00+07:00';
/** Spec 04 verification: forms whose records store every calculated field empty. */
const CALC_STORED_EMPTY = /^(10|17|18|24|29|30|31|35|40)-/;
/**
 * Spec 04 verification, calculation oracle: the generator rounded VAT with Python's `round`, the
 * form rounds half up, so opening corrects VAT and the total (records 004 and 010).
 */
const ROUNDING = ['04-purchase-request-004.xml', '04-purchase-request-010.xml'];
const buf = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

test('an untouched download is the opened bytes, for every own record', async () => {
  const xsns = readdirSync(new URL('xsn/', OWN)).filter((f) => f.endsWith('.xsn'));
  let identical = 0;
  const changedByOpen: string[] = [];
  const differs: string[] = [];
  for (const xsn of xsns) {
    const slug = xsn.replace(/\.xsn$/, '');
    const dir = new URL(`records/${slug}/`, OWN);
    const names = readdirSync(dir).filter((f) => /-\d{3}\.xml$/.test(f) && !f.endsWith('-000.xml'));
    const s = new Session();
    const res = await s.open([
      { name: xsn, bytes: buf(readFileSync(new URL(`xsn/${xsn}`, OWN))) },
      ...names.map((n) => ({ name: n, bytes: buf(readFileSync(new URL(n, dir))) })),
    ]);
    const t = res.templates[0]!;
    for (const r of res.records) {
      const opened = new Uint8Array(readFileSync(new URL(r.fileName, dir)));
      const f = await s.fillOpen(t.templateId, r.recordId, t.ir.views[0]!.name, NOW);
      const out = new Uint8Array(s.fillDownload().bytes);
      const same = Buffer.compare(Buffer.from(out), Buffer.from(opened)) === 0;
      if (same) identical++;
      else if (f.workedOut > 0) changedByOpen.push(r.fileName);
      else differs.push(r.fileName);
    }
  }
  console.log(
    `untouched download: ${identical} identical, ${changedByOpen.length} changed by opening, ${differs.length} corrected by opening`,
  );
  expect(differs).toEqual(ROUNDING);
  expect(changedByOpen.filter((n) => !CALC_STORED_EMPTY.test(n))).toEqual([]);
  expect(identical + changedByOpen.length + differs.length).toBe(348);
});
