// xdFormatting:formatString value logic (spec 03 design §7.1, R4.3), shared with spec 04. Pure:
// no Intl and no floating point on the value. Numbers are rounded on their decimal digits, so
// Node and a Worker give the same text (design D8). Tables are en-US (Windows locale 1033).
//
// The corpus patterns (docs/feature-coverage.md D; type + options as the views write them):
//   date        dateFormat:Short Date;
//   datetime    dateFormat:Short Date;timeFormat:h:mm:ss tt;     dateFormat:Short Date;timeFormat:none;
//               dateFormat:dd MMMM, yyyy;timeFormat:none;        dateFormat:dd-MMM-yy;timeFormat:none;
//   time        (no options)
//   number      numDigits:0;negativeOrder:0;grouping:1;          numDigits:2;negativeOrder:0;grouping:1;
//               numDigits:0;negativeOrder:1;   numDigits:2;negativeOrder:1;   numDigits:auto;negativeOrder:1;
//   currency    numDigits:2;negativeOrder:0;positiveOrder:0;currencyLocale:1033;
//   percentage  numDigits:0;negativeOrder:1;
//   string      plainMultiline
//
// Orders follow the Windows locale tables: LOCALE_INEGNUMBER (number), LOCALE_ICURRENCY and
// LOCALE_INEGCURR (currency), LOCALE_IPOSITIVEPERCENT and LOCALE_INEGATIVEPERCENT (percentage).
// [VERIFY: MS-IPFF2 formatString option definitions; no sample record holds a negative value.]

/** What formatString did: the text, and why it left the value as it was, if it did. */
export interface FormatResult {
  readonly text: string;
  /** An unknown type, option or option value: the value is returned unchanged. */
  readonly unsupported?: { readonly type: string; readonly option: string };
  /** A `currencyLocale` other than 1033: formatted as en-US. */
  readonly locale?: string;
}

const KNOWN_OPTIONS = new Set([
  'dateFormat',
  'timeFormat',
  'numDigits',
  'grouping',
  'negativeOrder',
  'positiveOrder',
  'currencyLocale',
  'plainMultiline',
]);

/** `key:value;` pairs, as InfoPath writes them; a bare `key;` has the value ''. */
export function formatOptions(options: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const part of options.split(';')) {
    const colon = part.indexOf(':');
    if (colon > 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
    else if (part.trim() !== '') out.set(part.trim(), '');
  }
  return out;
}

export function formatString(value: string, type: string, options: string): string {
  return formatStringResult(value, type, options).text;
}

/** Thrown inside, caught below: an option value this formatter does not know. */
class Unsupported extends Error {
  constructor(readonly option: string) {
    super(`formatString option ${option} is not supported`);
  }
}

export function formatStringResult(value: string, type: string, options: string): FormatResult {
  if (value === '') return { text: '' };
  const opts = formatOptions(options);
  for (const key of opts.keys()) {
    if (!KNOWN_OPTIONS.has(key)) return { text: value, unsupported: { type, option: key } };
  }
  try {
    switch (type) {
      case 'date':
        return { text: formatDate(value, opts) ?? value };
      case 'datetime':
        return { text: formatDateTime(value, opts) ?? value };
      case 'time':
        return { text: formatTime(value, opts) ?? value };
      case 'number':
        return { text: formatNumber(value, opts) ?? value };
      case 'currency': {
        const locale = opts.get('currencyLocale') ?? '1033';
        const text = formatCurrency(value, opts) ?? value;
        return locale === '1033' ? { text } : { text, locale };
      }
      case 'percentage':
        return { text: formatPercentage(value, opts) ?? value };
      case 'string':
        // plainMultiline: the text as written; its line breaks are the view's to show.
        return { text: value };
      default:
        return { text: value, unsupported: { type, option: 'type' } };
    }
  } catch (e) {
    if (e instanceof Unsupported) return { text: value, unsupported: { type, option: e.option } };
    throw e;
  }
}

// --- Dates and times --------------------------------------------------------------------------

interface Time {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly time?: Time;
}

const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const TIME = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/** An `xsd:date` or `xsd:dateTime` lexical value, shown as written: no time-zone conversion. */
export function parseDateTime(value: string): DateParts | undefined {
  const m = DATE_TIME.exec(value.trim());
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
  if (m[4] === undefined) return { year, month, day };
  const time = timeOf(m[4], m[5]!, m[6]!);
  return time && { year, month, day, time };
}

function timeOf(h: string, m: string, s: string): Time | undefined {
  const [hour, minute, second] = [Number(h), Number(m), Number(s)];
  return hour > 23 || minute > 59 || second > 59 ? undefined : { hour, minute, second };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const MONTHS = [
  ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August'],
  ...['September', 'October', 'November', 'December'],
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** en-US named formats (Windows 1033): Short Date `M/d/yyyy` ([seen] `11/3/2026`), Long Date. */
const NAMED_DATES: ReadonlyMap<string, string> = new Map([
  ['Short Date', 'M/d/yyyy'],
  ['Long Date', 'dddd, MMMM d, yyyy'],
]);
const DEFAULT_TIME = 'h:mm:ss tt';

/** Day of the week, 0 = Sunday (Sakamoto's method; proleptic Gregorian). */
function weekday(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  return (
    (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1]! + d) % 7
  );
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/**
 * A Windows date or time picture: `d dd ddd dddd M MM MMM MMMM y yy yyyy h hh H HH m mm s ss t
 * tt`, `'quoted'` text, and any other character as itself. A token the value cannot fill (a time
 * token for a date) gives undefined; a run the tables do not define throws Unsupported.
 */
function picture(pic: string, option: string, d: Partial<DateParts>): string | undefined {
  let out = '';
  for (let i = 0; i < pic.length;) {
    const c = pic[i]!;
    if (c === "'") {
      const end = pic.indexOf("'", i + 1);
      out += pic.slice(i + 1, end < 0 ? pic.length : end);
      i = end < 0 ? pic.length : end + 1;
      continue;
    }
    if (!'dMyhHmst'.includes(c)) {
      // Any other letter must be quoted: `Medium Date` is a name, not a picture.
      if (/[A-Za-z]/.test(c)) throw new Unsupported(option);
      out += c;
      i++;
      continue;
    }
    let n = 1;
    while (pic[i + n] === c) n++;
    i += n;
    const piece = token(c, n, d);
    if (piece === null) throw new Unsupported(option);
    if (piece === undefined) return undefined;
    out += piece;
  }
  return out;
}

function token(c: string, n: number, d: Partial<DateParts>): string | undefined | null {
  const t = d.time;
  switch (c) {
    case 'd':
      if (d.day === undefined) return undefined;
      if (n <= 2) return pad(d.day, n);
      if (n <= 4) {
        const name = DAYS[weekday(d.year!, d.month!, d.day)]!;
        return n === 3 ? name.slice(0, 3) : name;
      }
      return null;
    case 'M':
      if (d.month === undefined) return undefined;
      if (n <= 2) return pad(d.month, n);
      if (n <= 4) return n === 3 ? MONTHS[d.month - 1]!.slice(0, 3) : MONTHS[d.month - 1]!;
      return null;
    case 'y':
      if (d.year === undefined) return undefined;
      if (n === 1) return String(d.year % 100);
      if (n === 2) return pad(d.year % 100, 2);
      return n <= 5 ? pad(d.year, n === 5 ? 5 : 4) : null;
    case 'h':
      return n > 2 ? null : t && pad(t.hour % 12 || 12, n);
    case 'H':
      return n > 2 ? null : t && pad(t.hour, n);
    case 'm':
      return n > 2 ? null : t && pad(t.minute, n);
    case 's':
      return n > 2 ? null : t && pad(t.second, n);
    case 't':
      return n > 2 ? null : t && (t.hour < 12 ? 'AM' : 'PM').slice(0, n);
    default:
      return null;
  }
}

function datePicture(opts: ReadonlyMap<string, string>): string {
  const f = opts.get('dateFormat');
  if (f === undefined) throw new Unsupported('dateFormat');
  const named = NAMED_DATES.get(f);
  if (named !== undefined) return named;
  if (!/[dMy]/.test(f)) throw new Unsupported('dateFormat');
  return f;
}

const dateOnly = (d: DateParts): DateParts => ({ year: d.year, month: d.month, day: d.day });

function formatDate(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const d = parseDateTime(value);
  return d && picture(datePicture(opts), 'dateFormat', dateOnly(d));
}

/** Date, then the time; `timeFormat:none`, or a value with no time, shows the date only. */
function formatDateTime(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const d = parseDateTime(value);
  if (!d) return undefined;
  const date = picture(datePicture(opts), 'dateFormat', dateOnly(d));
  const tf = opts.get('timeFormat') ?? DEFAULT_TIME;
  if (date === undefined || tf === 'none' || !d.time) return date;
  const time = picture(tf, 'timeFormat', { time: d.time });
  return time === undefined ? undefined : `${date} ${time}`;
}

/** An `xsd:time` (or the time of an `xsd:dateTime`); `h:mm:ss tt` unless `timeFormat` says. */
function formatTime(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const v = value.trim();
  const m = TIME.exec(v);
  const time = m ? timeOf(m[1]!, m[2]!, m[3]!) : parseDateTime(v)?.time;
  if (!time) return undefined;
  const tf = opts.get('timeFormat') ?? DEFAULT_TIME;
  if (tf === 'none') throw new Unsupported('timeFormat');
  return picture(tf, 'timeFormat', { time });
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

/**
 * Rounds to `digits` fraction digits, half away from zero, on the digit string. [VERIFY: the
 * rounding mode InfoPath uses; no screenshot value needs rounding, design §7.1.]
 */
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

/** × 100 on the digit string: the point moves two places right. */
function percent(d: Decimal): Decimal {
  const frac = d.frac.padEnd(2, '0');
  return {
    negative: d.negative,
    int: (d.int + frac.slice(0, 2)).replace(/^0+/, ''),
    frac: frac.slice(2),
  };
}

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+$)/g, ',');
}

/**
 * The magnitude, rounded (`numDigits:n`) or as written (`numDigits:auto`), grouped when asked,
 * and whether it is negative and not zero.
 */
function magnitude(
  d: Decimal,
  opts: ReadonlyMap<string, string>,
  grouping: boolean,
): { text: string; negative: boolean } {
  const digits = opts.get('numDigits');
  if (digits === undefined || !/^(?:\d{1,2}|auto)$/.test(digits))
    throw new Unsupported('numDigits');
  const r = digits === 'auto' ? d : roundDecimal(d, Number(digits));
  const int = r.int === '' ? '0' : r.int;
  const zero = /^0*$/.test(r.int + r.frac);
  const text = (grouping ? group(int) : int) + (r.frac === '' ? '' : `.${r.frac}`);
  return { text, negative: r.negative && !zero };
}

function grouped(opts: ReadonlyMap<string, string>): boolean {
  const g = opts.get('grouping') ?? '0';
  if (g !== '0' && g !== '1') throw new Unsupported('grouping');
  return g === '1';
}

/** One entry of an order table, from an option; a missing option uses `fallback`. */
function order<T>(
  table: readonly T[],
  opts: ReadonlyMap<string, string>,
  key: string,
  fallback: number,
): T {
  const raw = opts.get(key);
  const i = raw === undefined ? fallback : /^\d{1,2}$/.test(raw) ? Number(raw) : -1;
  const entry = table[i];
  if (entry === undefined) throw new Unsupported(key);
  return entry;
}

type Shape = (n: string) => string;

/** LOCALE_INEGNUMBER: 0 `(1.1)`, 1 `-1.1`, 2 `- 1.1`, 3 `1.1-`, 4 `1.1 -`. */
const NEGATIVE_NUMBER: readonly Shape[] = [
  (n) => `(${n})`,
  (n) => `-${n}`,
  (n) => `- ${n}`,
  (n) => `${n}-`,
  (n) => `${n} -`,
];

function formatNumber(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const d = parseDecimal(value);
  if (!d) return undefined;
  const m = magnitude(d, opts, grouped(opts));
  const neg = order(NEGATIVE_NUMBER, opts, 'negativeOrder', 1);
  return m.negative ? neg(m.text) : m.text;
}

/** LOCALE_ICURRENCY 0–3 with `$`. */
const POSITIVE_CURRENCY: readonly Shape[] = [
  (n) => `$${n}`,
  (n) => `${n}$`,
  (n) => `$ ${n}`,
  (n) => `${n} $`,
];
/** LOCALE_INEGCURR 0–15 with `$`. */
const NEGATIVE_CURRENCY: readonly Shape[] = [
  (n) => `($${n})`,
  (n) => `-$${n}`,
  (n) => `$-${n}`,
  (n) => `$${n}-`,
  (n) => `(${n}$)`,
  (n) => `-${n}$`,
  (n) => `${n}-$`,
  (n) => `${n}$-`,
  (n) => `-${n} $`,
  (n) => `-$ ${n}`,
  (n) => `${n} $-`,
  (n) => `$ ${n}-`,
  (n) => `$ -${n}`,
  (n) => `${n}- $`,
  (n) => `($ ${n})`,
  (n) => `(${n} $)`,
];

/** en-US currency, always grouped: `350.3` → `$350.30` (docs/infopath-ux.md §3–4, [seen]). */
function formatCurrency(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const d = parseDecimal(value);
  if (!d) return undefined;
  const m = magnitude(d, opts, true);
  const pos = order(POSITIVE_CURRENCY, opts, 'positiveOrder', 0);
  const neg = order(NEGATIVE_CURRENCY, opts, 'negativeOrder', 0);
  return m.negative ? neg(m.text) : pos(m.text);
}

/** LOCALE_IPOSITIVEPERCENT 0–3. */
const POSITIVE_PERCENT: readonly Shape[] = [
  (n) => `${n} %`,
  (n) => `${n}%`,
  (n) => `%${n}`,
  (n) => `% ${n}`,
];
/** LOCALE_INEGATIVEPERCENT 0–11. */
const NEGATIVE_PERCENT: readonly Shape[] = [
  (n) => `-${n} %`,
  (n) => `-${n}%`,
  (n) => `-%${n}`,
  (n) => `%-${n}`,
  (n) => `%${n}-`,
  (n) => `${n}-%`,
  (n) => `${n}%-`,
  (n) => `-% ${n}`,
  (n) => `${n} %-`,
  (n) => `% ${n}-`,
  (n) => `% -${n}`,
  (n) => `${n}- %`,
];

/**
 * The value × 100, then as a number, with `%`. With no `positiveOrder`, en-US `n%` (order 1).
 * [VERIFY: InfoPath's default positive percent order; the corpus writes only negativeOrder:1.]
 */
function formatPercentage(value: string, opts: ReadonlyMap<string, string>): string | undefined {
  const d = parseDecimal(value);
  if (!d) return undefined;
  const m = magnitude(percent(d), opts, grouped(opts));
  const pos = order(POSITIVE_PERCENT, opts, 'positiveOrder', 1);
  const neg = order(NEGATIVE_PERCENT, opts, 'negativeOrder', 1);
  return m.negative ? neg(m.text) : pos(m.text);
}
