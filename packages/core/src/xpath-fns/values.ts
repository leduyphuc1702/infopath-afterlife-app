// Value logic of the InfoPath date, math and string extension functions (spec 03 design §7.1),
// shared with spec 04. Pure: no clock, no Intl. `now` is the render input (R1.4).

const NOW = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/** `xdDate:Today()`: the date of `now`, in `now`'s own offset: `2026-11-03`. */
export function today(now: string): string {
  return NOW.exec(now)?.[1] ?? '';
}

/** `xdDate:Now()`: `2026-11-03T09:00:00`, offset and fraction dropped. */
export function nowValue(now: string): string {
  const m = NOW.exec(now);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}` : '';
}

/** XPath 1.0 `number()` of a string: optional whitespace, `-`, digits and point; else NaN. */
export function xpathNumber(s: string): number {
  return /^[\t\n\r ]*-?(?:\d+(?:\.\d*)?|\.\d+)[\t\n\r ]*$/.test(s) ? Number(s.trim()) : NaN;
}

/** `xdMath:Avg`: the mean of `number()` over the values; NaN when empty or one is not a number. */
export function average(values: readonly string[]): number {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const v of values) sum += xpathNumber(v);
  return sum / values.length;
}

/** `xdMath:Nz`: each value, or `0` when it is blank (empty, or XML whitespace only). */
export function nz(values: readonly string[]): string[] {
  return values.map((v) => (/^[\t\n\r ]*$/.test(v) ? '0' : v));
}

/**
 * `msxsl:string-compare(a, b, lang, options)`: -1, 0 or 1 by UTF-16 code units; `options`
 * containing `i` compares with ASCII letters lowercased. `lang` is ignored (no Intl, D8).
 */
export function stringCompare(a: string, b: string, options = ''): number {
  const fold = options.includes('i')
    ? (s: string) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32))
    : (s: string) => s;
  const x = fold(a);
  const y = fold(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
