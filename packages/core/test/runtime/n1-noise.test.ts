// Spec 26 N1: a calculated number goes into the record with at most 15 significant digits, so
// opening a record changes nothing but what a recalculation really changes. Measured over the
// 348 own records: how many opening changes, how many of them only float noise, and how many
// calculated values equal the stored ones.
import { expect, test } from 'vitest';
import { Evaluator } from '../../src/index';
import { parseXmlDom, xmlContext } from '../../src/xml/parse';
import { resolveLimits } from '../../src/limits';
import { fill, NOW, recordNames, slugs } from './fill';
import { HEAVY_MS } from '../helpers/time';

test('spec 26 N1: a calculation writes 0.1 + 0.2 as 0.3, and 1472.13 as written', () => {
  const doc = parseXmlDom(
    new TextEncoder().encode('<r/>'),
    't.xml',
    xmlContext(resolveLimits()),
  ).doc;
  const ev = new Evaluator({}, () => undefined, NOW);
  expect(ev.recordString('0.1 + 0.2', doc)).toBe('0.3');
  expect(ev.recordString('1472.13 * 3 div 3', doc)).toBe('1472.13');
  expect(ev.recordString('1 div 3', doc)).toBe('0.333333333333333');
  expect(ev.recordString('"0.1"', doc)).toBe('0.1');
  // XPath's own string() is unchanged: rules compare as the engine does.
  expect(ev.string('0.1 + 0.2', doc)).toBe('0.30000000000000004');
});

const noisy = (s: string) => /\d{16,}/.test(s.replace(/[.-]/g, ''));

test(
  'spec 26 N1: opening the 348 own records',
  async () => {
    let records = 0;
    let changed = 0;
    let noiseOnly = 0;
    let calculated = 0;
    let equal = 0;
    for (const slug of slugs()) {
      for (const name of recordNames(slug).filter((n) => !n.endsWith('-000-empty.xml'))) {
        const { ir, s } = await fill(slug, name);
        records++;
        const changes = s.opened.changes;
        if (changes.length > 0) changed++;
        if (changes.length > 0 && changes.every((c) => noisy(c.after))) noiseOnly++;
        const targets = new Set(
          ir.calculations.flatMap((c) => (c.targetId ? s.paths(c.targetId) : [])),
        );
        // As spec 15 counted: calculated fields the record holds a value for.
        const stored = (p: string) => changes.find((c) => c.path === p)?.before ?? s.text(p) ?? '';
        const held = [...targets].filter((p) => stored(p) !== '');
        calculated += held.length;
        equal += held.filter((p) => !changes.some((c) => c.path === p)).length;
      }
    }
    console.log(
      `N1: ${records} records, ${changed} changed by opening (${noiseOnly} of them with float noise in what opening wrote); calculated ${equal} of ${calculated} equal`,
    );
    expect(records).toBe(348);
    expect(noiseOnly).toBe(0);
  },
  HEAVY_MS,
);
