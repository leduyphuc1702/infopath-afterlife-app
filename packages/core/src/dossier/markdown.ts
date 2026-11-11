// Spec 15 R3.3, R3.4, D1: the dossier as Markdown. Nothing a form says can become markup, HTML
// or a link: text is escaped, and anything that could autolink goes into a code span.
import type { Dossier, DossierItem } from './build';

const flat = (s: string) => s.replace(/[\r\n\t\f\v\u2028\u2029]+/g, ' ');

/** A code span that holds `s` exactly: a backtick run longer than any inside it. */
export function mdCode(s: string, inTable = false): string {
  const t = flat(s);
  const longest = Math.max(0, ...[...t.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  const pad = t.startsWith('`') || t.endsWith('`') || t === '' ? ' ' : '';
  const body = inTable ? t.replace(/\|/g, '\\|') : t;
  return `${fence}${pad}${body}${pad}${fence}`;
}

/**
 * Could autolink: a scheme, `www.`, an e-mail address, or (spec 19 P3a) a dotted name such as a
 * host, which some renderers link bare. Trailing punctuation stays outside the code span.
 */
const LINKY = /\S*(?:[a-z][a-z0-9+.-]*:\/\/|www\.|@|[a-z0-9-]\.[a-z][a-z0-9-]+)\S*/gi;
const TRAIL = /[.,;:!?)\]”’"']+$/;

/**
 * Spec 16 K6: plain text, escaped only where a character could become markup where it stands,
 * so pasted Markdown still reads as text: `\\`, `` ` ``, `*`, `[`, `]`, `<`, `~` anywhere; `_`
 * at a word's edge; `&` that starts an entity; `|` in a table cell; and what would start a
 * block (`#`, `>`, `+`, `-`, `=`, `1.`) at the start. Link-like tokens become code spans.
 */
export function mdText(s: string, inTable = false): string {
  // Spec 19 P3b: leading spaces would make an indented code block.
  const t = flat(s).replace(/^\s+/, '');
  let out = '';
  let last = 0;
  for (const m of t.matchAll(LINKY)) {
    const token = m[0].replace(TRAIL, '');
    if (token === '') continue;
    out += esc(t.slice(last, m.index), inTable) + mdCode(token, inTable);
    last = m.index + token.length;
  }
  out += esc(t.slice(last), inTable);
  // Spec 19 P3c: a number starts a list only when a space or the end follows its `.` or `)`.
  return out.replace(/^(\s*)([#>+=-]|\d+(?=[.)](\s|$)))/, (_, sp: string, c: string) =>
    /\d/.test(c) ? `${sp}${c}\\` : `${sp}\\${c}`,
  );
}

const esc = (s: string, inTable: boolean) =>
  s.replace(/[\\`*[\]<~|]|&(?=#?\w+;)|_/g, (c, at: number) => {
    if (c === '|' && !inTable) return c;
    if (c === '_') {
      const alnum = (x: string | undefined) => x !== undefined && /[A-Za-z0-9]/.test(x);
      if (alnum(s[at - 1]) && alnum(s[at + 1])) return c;
    }
    return `\\${c}`;
  });

/** Each expression on its own line under the sentence: a backslash at a line's end breaks it. */
const item = (i: DossierItem) =>
  [`- ${mdText(i.sentence)}`, ...i.expressions.map((e) => `  <sub>${mdCode(e)}</sub>`)].join(
    '\\\n',
  );

const items = (xs: readonly DossierItem[], none: string) =>
  xs.length ? xs.map(item).join('\n') : `- ${mdText(none)}`;

export function dossierMarkdown(d: Dossier): string {
  const cell = (s: string) => mdText(s, true);
  const fields = d.fields.length
    ? [
        '| Label | Path | Type | Required | Default | Views |',
        '|---|---|---|---|---|---|',
        ...d.fields.map(
          (f) =>
            `| ${cell(f.label)} | ${mdCode(f.path, true)} | ${cell(f.type)} | ${f.required ? 'Yes' : ''} | ${f.default === '' ? '' : mdCode(f.default, true)} | ${cell(f.views.join(', '))} |`,
        ),
      ].join('\n')
    : mdText('The main data source has no fields.');
  return [
    `# ${mdText(d.name)}: form documentation`,
    '',
    '## What the form is',
    '',
    ...d.about.map((a) => `- **${mdText(a.label)}:** ${mdText(a.value)}`),
    '',
    '## Fields',
    '',
    fields,
    '',
    '## Logic',
    '',
    '### When the form opens',
    '',
    items(d.logic.onOpen, 'Nothing runs when the form opens.'),
    '',
    '### Rules',
    '',
    items(d.logic.rules, 'The form has no rules.'),
    '',
    '### Calculations',
    '',
    items(d.logic.calculations, 'The form has no calculated fields.'),
    '',
    '### Validations',
    '',
    items(d.logic.validations, 'The form has no validations.'),
    '',
    '### Buttons',
    '',
    items(d.logic.buttons, 'No button runs rules.'),
    '',
    '## Data connections',
    '',
    items(d.connections, 'The form has no data connections.'),
    '',
    '## What depends on what',
    '',
    items(d.depends, 'No field feeds a calculation, rule, validation or choice list.'),
    '',
    '## What could not be read',
    '',
    items(d.unread, 'Everything in the template was read.'),
    '',
  ].join('\n');
}

/** R3.3: `index.md` of the documentation `.zip`. */
export function dossierIndex(
  entries: readonly { readonly name: string; readonly file: string }[],
): string {
  return [
    '# Form documentation',
    '',
    ...entries.map((e) => `- ${mdText(e.name)}: ${mdCode(e.file)}`),
    '',
  ].join('\n');
}
