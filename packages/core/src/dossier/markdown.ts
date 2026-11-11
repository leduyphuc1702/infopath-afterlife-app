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

/** Could autolink in GFM: a scheme, `www.`, or an e-mail address. */
const LINKY = /\S*(?:[a-z][a-z0-9+.-]*:\/\/|www\.|@)\S*/gi;

/** Plain text: every ASCII punctuation character escaped; link-like tokens as code. */
export function mdText(s: string, inTable = false): string {
  const t = flat(s);
  let out = '';
  let last = 0;
  for (const m of t.matchAll(LINKY)) {
    out += esc(t.slice(last, m.index)) + mdCode(m[0], inTable);
    last = m.index + m[0].length;
  }
  return out + esc(t.slice(last));
}

const esc = (s: string) => s.replace(/[!-/:-@[-`{-~]/g, (c) => `\\${c}`);

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
