// xdFormatting:formatString value logic (spec 03 design §7.1, R4.3), shared with spec 04. Pure:
// no Intl and no floating point on the value. Numbers are rounded on their decimal digits, so
// Node and a Worker give the same text (design D8).
//
// Task 2 covers the five patterns of the 53 views (requirements, Evidence):
//   date     + dateFormat:Short Date;
//   datetime + dateFormat:Short Date;timeFormat:h:mm:ss tt;
//   currency + numDigits:2;negativeOrder:0;positiveOrder:0;currencyLocale:1033;
//   number   + numDigits:0|2;negativeOrder:0;grouping:1;
// Anything else returns the value unchanged; task 7 adds the rest of the corpus patterns and the
// FORMAT_UNSUPPORTED and LOCALE_UNSUPPORTED issues.
//
// Negative and positive orders follow the Windows en-US locale tables (LOCALE_INEGNUMBER,
// LOCALE_INEGCURR, LOCALE_ICURRENCY). [VERIFY: MS-IPFF2 formatString option definitions; no
// sample record holds a negative value.]

/** `key:value;` pairs, as InfoPath writes them; the value runs to the next `;`. */
export function formatOptions(options: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const part of options.split(';')) {
    const colon = part.indexOf(':');
    if (colon > 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
  }
  return out;
}

export function formatString(value: string, type: string, options: string): string {
  if (value === '') return '';
  const opts = formatOptions(options);
  switch (type) {
    case 'date':
      return formatDate(value, opts) ?? value;
    case 'datetime':
      return formatDateTime(value, opts) ?? value;
    case 'number':
      return formatNumber(value, opts) ?? value;
    case 'currency':
      return formatCurrency(value, opts) ?? value;
    default:
      return value;
  }
}

// --- Dates ------------------------------------------------------------------------------------

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly time?: { readonly hour: number; readonly minute: string; readonly second: string };
}

const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/;

/** An `xsd:date` or `xsd:dateTime` lexical value, shown as written: no time-zone conversion. */
export function parseDateTime(value: string): DateParts | undefined {
  const m = DATE_TIME.exec(value.trim());
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
  if (m[4] === undefined) return { year, month, day };
  const hour = Number(m[4]);
  if (hour > 23 || Number(m[5]) > 59 || Number(m[6]) > 59) return undefined;
  return { year, month, day, time: { hour, minute: m[5]!, second: m[6]! } };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** en-US Short Date, `M/d/yyyy`: `2026-11-03` → `11/3/2026` (docs/infopath-ux.md §3, [seen]). */
function shortDate(d: DateParts): string {
  return `${d.month}/${d.day}/${d.year}`;
}

function formatDate(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const d = parseDateTime(value);
  if (!d || opts.get('dateFormat') !== 'Short Date') return undefined;
  return shortDate(d);
}

/** `h:mm:ss tt`: `14:05:09` → `2:05:09 PM`. A date with no time shows the date only. */
function formatDateTime(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const d = parseDateTime(value);
  if (!d || opts.get('dateFormat') !== 'Short Date') return undefined;
  if (!d.time) return shortDate(d);
  if (opts.get('timeFormat') !== 'h:mm:ss tt') return undefined;
  const { hour, minute, second } = d.time;
  return `${shortDate(d)} ${hour % 12 || 12}:${minute}:${second} ${hour < 12 ? 'AM' : 'PM'}`;
}

// --- Numbers ----------------------------------------------------------------------------------

interface Decimal {
  readonly negative: boolean;
  /** Digits before the point, no leading zeros ('' for zero). */
  readonly int: string;
  readonly frac: string;
}

/** An XPath 1.0 Number lexical value (optional minus, digits, optional point), or undefined. */
export function parseDecimal(value: string): Decimal | undefined {
  const m = /^\s*(-?)(\d*)(?:\.(\d*))?\s*$/.exec(value);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) return undefined;
  return { negative: m[1] === '-', int: m[2]!.replace(/^0+/, ''), frac: m[3] ?? '' };
}

/** Rounds to `digits` fraction digits, half away from zero, on the digit string. */
export function roundDecimal(d: Decimal, digits: number): Decimal {
  if (d.frac.length <= digits) return { ...d, frac: d.frac.padEnd(digits, '0') };
  const kept = d.int + d.frac.slice(0, digits);
  const up = d.frac.charCodeAt(digits) >= 0x35; // '5'
  const all = up ? increment(kept === '' ? '0' : kept) : kept;
  const intLength = all.length - digits;
  return {
    negative: d.negative,
    int: all.slice(0, intLength).replace(/^0+/, ''),
    frac: all.slice(intLength),
  };
}

function increment(digits: string): string {
  const out = digits.split('');
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] !== '9') {
      out[i] = String.fromCharCode(out[i]!.charCodeAt(0) + 1);
      return out.join('');
    }
    out[i] = '0';
  }
  return `1${out.join('')}`;
}

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+$)/g, ',');
}

/** The magnitude, rounded and grouped, and whether it is negative and not zero. */
function magnitude(
  value: string,
  opts: ReadonlyMap<string, string>,
  grouping: boolean,
): { text: string; negative: boolean } | undefined {
  const d = parseDecimal(value);
  const digits = opts.get('numDigits');
  if (!d || digits === undefined || !/^\d{1,2}$/.test(digits)) return undefined;
  const r = roundDecimal(d, Number(digits));
  const int = r.int === '' ? '0' : r.int;
  const zero = /^0*$/.test(r.int + r.frac);
  const text = (grouping ? group(int) : int) + (r.frac === '' ? '' : `.${r.frac}`);
  return { text, negative: r.negative && !zero };
}

/** LOCALE_INEGNUMBER: 0 `(1.1)`, 1 `-1.1`, 2 `- 1.1`, 3 `1.1-`, 4 `1.1 -`. */
const NEGATIVE_NUMBER = [
  (n: string) => `(${n})`,
  (n: string) => `-${n}`,
  (n: string) => `- ${n}`,
  (n: string) => `${n}-`,
  (n: string) => `${n} -`,
];

function formatNumber(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const m = magnitude(value, opts, opts.get('grouping') === '1');
  if (!m) return undefined;
  if (!m.negative) return m.text;
  const order = NEGATIVE_NUMBER[Number(opts.get('negativeOrder') ?? '1')];
  return order ? order(m.text) : undefined;
}

/** LOCALE_ICURRENCY 0–3 with `$`: `$1.1`, `1.1$`, `$ 1.1`, `1.1 $`. */
const POSITIVE_CURRENCY = [
  (n: string) => `$${n}`,
  (n: string) => `${n}$`,
  (n: string) => `$ ${n}`,
  (n: string) => `${n} $`,
];
/** LOCALE_INEGCURR 0–3 with `$`: `($1.1)`, `-$1.1`, `$-1.1`, `$1.1-`. */
const NEGATIVE_CURRENCY = [
  (n: string) => `($${n})`,
  (n: string) => `-$${n}`,
  (n: string) => `$-${n}`,
  (n: string) => `$${n}-`,
];

/** en-US currency (`currencyLocale:1033`), always grouped: `350.3` → `$350.30` (§3–4, [seen]). */
function formatCurrency(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  if ((opts.get('currencyLocale') ?? '1033') !== '1033') return undefined;
  const m = magnitude(value, opts, true);
  if (!m) return undefined;
  const order = m.negative
    ? NEGATIVE_CURRENCY[Number(opts.get('negativeOrder') ?? '0')]
    : POSITIVE_CURRENCY[Number(opts.get('positiveOrder') ?? '0')];
  return order ? order(m.text) : undefined;
}
