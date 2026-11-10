// Credentials in connection values: one implementation for spec 01's `containsCredential` (R11.5)
// and spec 02's redaction (R8.4), so the flag and the redaction always agree.

export interface Pair {
  /** Trimmed, lower-case. */
  readonly key: string;
  readonly value: string;
  /** Offsets of the value (after `=`, to the end of the pair) in the string. */
  readonly start: number;
  readonly end: number;
}

/** `key=value` pairs split on `;`, with `"…"`, `'…'` and `{…}` values kept whole. */
export function connectionPairs(s: string): Pair[] {
  const out: Pair[] = [];
  let i = 0;
  while (i <= s.length) {
    const eq = s.indexOf('=', i);
    const semi = s.indexOf(';', i);
    if (eq < 0 || (semi >= 0 && semi < eq)) {
      if (semi < 0) break;
      i = semi + 1;
      continue;
    }
    const key = s.slice(i, eq);
    let j = eq + 1;
    while (j < s.length && /\s/.test(s[j]!)) j++;
    const open = s[j];
    const close = open === '"' || open === "'" ? open : open === '{' ? '}' : undefined;
    if (close !== undefined) {
      j++;
      for (; j < s.length; j++) {
        if (s[j] === close) {
          if (close !== '}' && s[j + 1] === close) j++;
          else break;
        }
      }
      j++;
    }
    const end = s.indexOf(';', Math.min(j, s.length));
    const stop = end < 0 ? s.length : end;
    out.push({
      key: key.trim().toLowerCase(),
      value: s.slice(eq + 1, stop).trim(),
      start: eq + 1,
      end: stop,
    });
    i = stop + 1;
  }
  return out;
}

/**
 * A secret key: `password` or `pwd`, or a key ending in whitespace or `:` followed by one of them
 * (`Jet OLEDB:Database Password`, `Jet OLEDB:New Database Password`). Not `MyPassword`.
 */
export const isSecretKey = (key: string): boolean => /(^|[\s:])(password|pwd)$/i.test(key.trim());

/** `scheme://userinfo@`: the userinfo runs to the last `@` before `/`, `\`, `?`, `#` or a space. */
const URL_USERINFO = /([a-z][a-z0-9+.-]*:\/\/)([^/\\?#\s"'<>]*)@/gi;

/**
 * Every secret value replaced by `***`, the rest byte for byte: the value of each secret key
 * (whitespace around it kept), and the password of each URL userinfo (the user name kept). Never
 * goes through `URL` serialisation.
 */
export function redactSecrets(s: string): { readonly value: string; readonly redacted: boolean } {
  if (!/password|pwd|@/i.test(s)) return { value: s, redacted: false };
  let out = '';
  let at = 0;
  let redacted = false;
  for (const p of connectionPairs(s)) {
    if (!isSecretKey(p.key)) continue;
    const raw = s.slice(p.start, p.end);
    const lead = /^\s*/.exec(raw)![0].length;
    const trail = raw.length - raw.trimEnd().length;
    const valueEnd = Math.max(p.start + lead, p.end - trail);
    out += `${s.slice(at, p.start + lead)}***`;
    at = valueEnd;
    redacted = true;
  }
  out += s.slice(at);
  const value = out.replace(URL_USERINFO, (whole, scheme: string, userinfo: string) => {
    const colon = userinfo.indexOf(':');
    if (colon < 0 || colon === userinfo.length - 1) return whole;
    redacted = true;
    return `${scheme}${userinfo.slice(0, colon)}:***@`;
  });
  return { value, redacted };
}

/** Spec 01 R11.5: true exactly when `redactSecrets` would redact something. */
export const containsCredential = (s: string): boolean => redactSecrets(s).redacted;
