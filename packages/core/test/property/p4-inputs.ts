// Inputs of property P4 (spec 03 R7.1, design §10): sample records of the 53 views whose text
// values are replaced by generated strings, and a generated `now`, locale and user name. Several
// renders per run, so the property can render them in two orders.

import fc from 'fast-check';

export interface P4Render {
  /** Index into the 53 view cases, modulo their number. */
  readonly view: number;
  readonly record: 'empty' | 'first';
  /** Replacement text values, used in turn for the record's non-blank text nodes. */
  readonly values: readonly string[];
  /** Text nodes kept as they are, by index modulo 3: 0 replaces all, 1 every other, 2 none. */
  readonly keep: number;
}

export interface P4Input {
  readonly renders: readonly P4Render[];
  readonly now: string;
  readonly locale: string;
  readonly userName: string;
  /** The second order: a permutation of the renders' indexes. */
  readonly order: readonly number[];
}

/** Without the characters XML 1.0 refuses, and lone surrogates, which UTF-8 cannot carry. */
const xmlSafe = (s: string) =>
  [...s]
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      if (c < 0x20) return c === 0x09 || c === 0x0a || c === 0x0d;
      return !(c >= 0xd800 && c <= 0xdfff) && c !== 0xfffe && c !== 0xffff;
    })
    .join('');

const SPECIAL = [
  '"',
  "'",
  '<',
  '>',
  '&',
  '&amp;',
  ']]>',
  '<b>x</b>',
  '\u{1F600}',
  '\u{10FFFF}',
  '\u{20000}',
  '   ',
  '\t\n\r\n  ',
  '\u00A0',
  '\u200B',
  '-0',
  '1e400',
  'NaN',
  '2026-02-30',
  '12/31/1999',
  '350.3',
  '-1234567.555',
  '{',
  '}',
  'javascript:alert(1)',
];

const piece = fc.oneof(
  { arbitrary: fc.constantFrom(...SPECIAL), weight: 3 },
  fc.string({ unit: 'binary', maxLength: 12 }),
  fc.string({ unit: 'grapheme', maxLength: 8 }),
);

/** A text value: pieces joined, sometimes repeated into a long value (up to 3,000 characters). */
export const textValue: fc.Arbitrary<string> = fc
  .tuple(fc.array(piece, { minLength: 0, maxLength: 6 }), fc.oneof(fc.constant(1), fc.nat(250)))
  .map(([parts, repeat]) => parts.join('').repeat(Math.max(1, repeat)).slice(0, 3000))
  .map(xmlSafe);

const two = (n: number) => String(n).padStart(2, '0');

export const nowValue: fc.Arbitrary<string> = fc
  .record({
    y: fc.integer({ min: 1900, max: 2100 }),
    mo: fc.integer({ min: 1, max: 12 }),
    d: fc.integer({ min: 1, max: 28 }),
    h: fc.integer({ min: 0, max: 23 }),
    mi: fc.integer({ min: 0, max: 59 }),
    s: fc.option(fc.integer({ min: 0, max: 59 })),
    ms: fc.option(fc.integer({ min: 0, max: 999 })),
    zone: fc.oneof(
      fc.constant('Z'),
      fc
        .record({
          sign: fc.constantFrom('+', '-'),
          h: fc.integer({ min: 0, max: 14 }),
          m: fc.constantFrom(0, 30, 45),
        })
        .map((z) => `${z.sign}${two(z.h)}:${two(z.m)}`),
    ),
  })
  .map(({ y, mo, d, h, mi, s, ms, zone }) => {
    const sec =
      s === null ? '' : `:${two(s)}${ms === null ? '' : `.${String(ms).padStart(3, '0')}`}`;
    return `${y}-${two(mo)}-${two(d)}T${two(h)}:${two(mi)}${sec}${zone}`;
  });

export const localeValue: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    'en-US',
    'en-us',
    'en',
    'vi-VN',
    'de-DE',
    'fr-CA',
    'ja-JP',
    'zh-Hant-TW',
    'ar-SA',
  ),
  fc
    .tuple(
      fc.stringMatching(/^[a-z]{2,3}$/),
      fc.array(fc.stringMatching(/^[A-Za-z0-9]{1,8}$/), { maxLength: 2 }),
    )
    .map(([lang, subtags]) => [lang, ...subtags].join('-')),
);

const p4Render: fc.Arbitrary<P4Render> = fc.record({
  view: fc.nat(),
  record: fc.constantFrom<'empty' | 'first'>('empty', 'first'),
  values: fc.array(textValue, { minLength: 1, maxLength: 5 }),
  keep: fc.nat(2),
});

export const p4Input: fc.Arbitrary<P4Input> = fc
  .array(p4Render, { minLength: 2, maxLength: 3 })
  .chain((renders) =>
    fc.record({
      renders: fc.constant(renders),
      now: nowValue,
      locale: localeValue,
      userName: textValue,
      order: fc.shuffledSubarray(
        renders.map((_, i) => i),
        { minLength: renders.length, maxLength: renders.length },
      ),
    }),
  );

const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');

/**
 * The record with its non-blank text nodes replaced by `values` in turn. Text is only between a
 * tag's `>` and the next `<`; the processing instructions and the root are kept.
 */
export function replaceText(record: string, r: Pick<P4Render, 'values' | 'keep'>): string {
  let i = 0;
  return record.replace(/>([^<]*[^<\s][^<]*)</g, (whole: string) => {
    const n = i++;
    if (r.keep === 2 || (r.keep === 1 && n % 2 === 1)) return whole;
    return `>${escapeText(r.values[n % r.values.length]!)}<`;
  });
}
