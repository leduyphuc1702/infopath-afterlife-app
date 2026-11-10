// CSS without a DOM (spec 03 design §8.4): the declaration filter for `style` attributes and view
// style sheets, and scoping of view rules to the render root (R5.1, R5.5).
//
// Comments are removed first, and the output is the comment-free text, so what is checked is what
// the browser reads. Checks run on a decoded copy: CSS escapes (`e\78pression`) resolved,
// lowercased, whitespace and control characters removed. Anything that does not tokenize
// cleanly (an unterminated string, unbalanced brackets, a brace or `<` where none belongs) is
// dropped, so a kept declaration cannot end its block early or close a `style` element.

/** What the filter took out, by name (`behavior`, `@import`, `selector`, …). */
export type Removed = string[];

const DENIED_PROPERTIES = new Set(['behavior', '-ms-behavior', '-moz-binding']);
/**
 * Text a kept value may not hold. `@import` (`Changed at task 12:`, found by P5): inside a value it
 * is inert in today's browsers, but R5.1 names it, so a value holding it goes.
 */
const DENIED_IN_VALUE = ['expression(', 'image(', 'image-set(', 'element(', 'src(', '@import'];
const RASTER_DATA = /^data:image\/(?:png|gif|jpeg|bmp);base64,[a-z0-9+/=]*$/;

export const scopeSelector = (scope: string) => `.afl-root[data-afl-scope="${scope}"]`;

/** D11: 32-bit FNV-1a over the UTF-8 of `urn \n version \n view`, as `s` + 8 hex digits. */
export function scopeId(urn: string, version: string, view: string): string {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(`${urn}\n${version}\n${view}`)) {
    h = Math.imul(h ^ b, 0x01000193) >>> 0;
  }
  return `s${h.toString(16).padStart(8, '0')}`;
}

// --- Scanning ----------------------------------------------------------------------------------

/** The text with every comment removed; strings and escapes are respected. */
export function stripComments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '\\') {
      out += text.slice(i, i + 2);
      i += 2;
    } else if (c === '"' || c === "'") {
      const end = stringEnd(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      i = close < 0 ? text.length : close + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index just after the string opened at `start`; a string ends at its quote, a newline or EOF. */
function stringEnd(text: string, start: number): number {
  return scanString(text, start).end;
}

/** The string opened at `start`: where it ends, and whether its own quote closed it. */
function scanString(text: string, start: number): { end: number; closed: boolean } {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '\\') i += 2;
    else if (c === quote) return { end: i + 1, closed: true };
    else if (c === '\n' || c === '\r' || c === '\f') return { end: i, closed: false };
    else i++;
  }
  return { end: Math.min(i, text.length), closed: false };
}

/**
 * Splits `text` at each top-level `sep` (outside strings, brackets and escapes). Returns the
 * parts and whether the text tokenized cleanly.
 */
function split(text: string, sep: string): { parts: string[]; clean: boolean } {
  const parts: string[] = [];
  const stack: string[] = [];
  let clean = true;
  let from = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '\\') {
      if (i + 1 >= text.length || text[i + 1] === '\n') clean = false;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const { end, closed } = scanString(text, i);
      if (!closed) clean = false;
      i = end;
      continue;
    }
    if (c === '(' || c === '[') stack.push(c === '(' ? ')' : ']');
    else if (c === ')' || c === ']') {
      if (stack.pop() !== c) clean = false;
    } else if (c === '{' || c === '}' || c === '<') clean = false;
    else if (c === sep && stack.length === 0) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
    i++;
  }
  if (stack.length > 0) clean = false;
  parts.push(text.slice(from));
  return { parts, clean };
}

/** The text without ASCII whitespace and control characters (U+0000–U+0020, U+007F). */
export function withoutControls(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c > 0x20 && c !== 0x7f) out += ch;
  }
  return out;
}

const clean = (text: string) => !text.includes('<') && split(text, ',').clean;

/** The decoded check form: escapes resolved, lowercased, whitespace and controls removed. */
export function normalise(text: string): string {
  const decoded = text.replace(
    /\\(?:([0-9a-fA-F]{1,6})[ \t\n\r\f]?|(\r\n|[\n\r\f])|([\s\S]))/g,
    (_m, hex: string | undefined, _nl: string | undefined, ch: string | undefined) => {
      if (hex !== undefined) {
        const cp = parseInt(hex, 16);
        return cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)
          ? '\uFFFD'
          : String.fromCodePoint(cp);
      }
      return ch ?? '';
    },
  );
  return withoutControls(decoded.toLowerCase());
}

/** Every `url(…)` argument in a normalised value, unquoted; undefined when one is not closed. */
function urls(value: string): string[] | undefined {
  const out: string[] = [];
  let at = value.indexOf('url(');
  while (at >= 0) {
    const close = value.indexOf(')', at + 4);
    if (close < 0) return undefined;
    out.push(value.slice(at + 4, close).replace(/^(["'])(.*)\1$/, '$2'));
    at = value.indexOf('url(', close);
  }
  return out;
}

// --- Declarations ------------------------------------------------------------------------------

/**
 * The declarations of a `style` attribute or a rule block that pass the filter, joined by `;`.
 * `removed` names each dropped declaration; InfoPath's `behavior: url(#default#…)` is dropped
 * without a name (design §8.4, silent).
 */
export function filterDeclarations(text: string, removed: Removed): string {
  const kept: string[] = [];
  const { parts } = split(stripComments(text), ';');
  for (const part of parts) {
    if (part.trim() === '') continue;
    const colon = topLevelColon(part);
    const prop = colon < 0 ? '' : part.slice(0, colon).trim();
    const value = colon < 0 ? '' : part.slice(colon + 1).trim();
    const name = normalise(prop);
    if (name === '' || part.includes('<') || !split(part, ';').clean) {
      removed.push('declaration');
      continue;
    }
    const v = normalise(value);
    if (DENIED_PROPERTIES.has(name)) {
      const all = urls(v);
      const runtime =
        all !== undefined && all.length > 0 && all.every((u) => u.startsWith('#default#'));
      if (!runtime) removed.push(name);
      continue;
    }
    const found = urls(v);
    if (
      DENIED_IN_VALUE.some((f) => v.includes(f)) ||
      found === undefined ||
      !found.every((u) => RASTER_DATA.test(u))
    ) {
      removed.push(name);
      continue;
    }
    kept.push(`${prop}:${value}`);
  }
  return kept.join(';');
}

function topLevelColon(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '\\') i++;
    else if (c === '"' || c === "'") i = stringEnd(text, i) - 1;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

// --- Style sheets ------------------------------------------------------------------------------

/**
 * A view style sheet with every selector scoped under the render root. `@media` blocks are kept
 * and scoped; every other at-rule is dropped.
 */
export function scopeCss(text: string, scope: string, removed: Removed): string {
  return rules(stripComments(text), scopeSelector(scope), removed, true).join('\n');
}

function rules(text: string, root: string, removed: Removed, top: boolean): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ws = /^(?:\s|<!--|-->)+/.exec(text.slice(i));
    if (ws) {
      i += ws[0].length;
      continue;
    }
    const { prelude, block, end } = nextRule(text, i);
    i = end;
    const head = prelude.trim();
    if (head.startsWith('@')) {
      const raw = /^@[\w-]*/.exec(head)![0];
      const name = normalise(raw);
      const condition = head.slice(raw.length).trim();
      if (name === '@media' && top && block !== undefined && clean(condition)) {
        const inner = rules(block, root, removed, false);
        if (inner.length > 0) out.push(`@media ${condition}{${inner.join('\n')}}`);
      } else {
        removed.push(name);
      }
      continue;
    }
    if (block === undefined) {
      if (head !== '') removed.push('selector');
      continue;
    }
    const selectors = scopeSelectors(head, root, removed);
    if (selectors.length === 0) continue;
    const decls = filterDeclarations(block, removed);
    if (decls !== '') out.push(`${selectors.join(',')}{${decls}}`);
  }
  return out;
}

/**
 * The rule starting at `start`: the prelude up to the first top-level `{` (or `;` for an at-rule
 * with no block), the block content up to its matching `}` (or EOF), and where the next starts.
 */
function nextRule(text: string, start: number): { prelude: string; block?: string; end: number } {
  const at = text[start] === '@';
  let i = start;
  let depth = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '\\') i += 2;
    else if (c === '"' || c === "'") i = stringEnd(text, i);
    else if (c === ';' && at && depth <= 0) return { prelude: text.slice(start, i), end: i + 1 };
    else if (c === '{') break;
    else {
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      i++;
    }
  }
  if (i >= text.length) return { prelude: text.slice(start), end: text.length };
  const open = i;
  let braces = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '\\') i += 2;
    else if (c === '"' || c === "'") i = stringEnd(text, i);
    else {
      if (c === '{') braces++;
      else if (c === '}' && --braces === 0) break;
      i++;
    }
  }
  return {
    prelude: text.slice(start, open),
    block: text.slice(open + 1, Math.min(i, text.length)),
    end: Math.min(i + 1, text.length),
  };
}

/** Each selector of a list, scoped; one that does not tokenize cleanly is dropped. */
function scopeSelectors(list: string, root: string, removed: Removed): string[] {
  const { parts, clean } = split(list, ',');
  const out: string[] = [];
  for (const part of parts) {
    const sel = part.trim();
    if (!clean || sel === '' || /[@;<]/.test(sel)) {
      removed.push('selector');
      continue;
    }
    out.push(scopeOne(sel, root));
  }
  return out;
}

/** A leading `html`, `body` or `:root` compound becomes the root; anything else gets it as an ancestor. */
function scopeOne(sel: string, root: string): string {
  const lead = /^(?:html|body|:root)(?![\w-])/i.exec(sel);
  if (!lead) return `${root} ${sel}`;
  let rest = sel.slice(lead[0].length);
  if (lead[0].toLowerCase() !== 'body') {
    const body = /^\s*(?:>\s*)?body(?![\w-])/i.exec(rest);
    if (body) rest = rest.slice(body[0].length);
  }
  return `${root}${rest}`;
}
