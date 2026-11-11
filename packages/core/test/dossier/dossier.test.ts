// Spec 15: the form dossier. P19 over the 48 in-repo forms, section order, determinism, form
// 04's sentences, and the Markdown escaping (R3.4).
import fc from 'fast-check';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  buildDossier,
  dossierMarkdown,
  mdCode,
  mdText,
  type Dossier,
  type FormIR,
} from '../../src/index';
import { sampleIRs, type SampleIR } from '../helpers/irs';

let samples: SampleIR[];
beforeAll(async () => {
  samples = await sampleIRs();
}, 60_000);

const dossierOf = (s: SampleIR, records = 0) =>
  buildDossier(s.ir, { fileName: s.fileName, records });
const allItems = (d: Dossier) => [
  ...d.logic.onOpen,
  ...d.logic.rules,
  ...d.logic.calculations,
  ...d.logic.validations,
  ...d.logic.buttons,
  ...d.connections,
  ...d.depends,
  ...d.unread,
];

describe('P19: every rule, calculation, validation and connection appears exactly once', () => {
  test('all 48 forms', () => {
    expect(samples.length).toBe(48);
    for (const s of samples) {
      const ids = allItems(dossierOf(s)).flatMap((i) => (i.id === undefined ? [] : [i.id]));
      const want = [
        ...s.ir.rules.map((r) => r.id),
        ...s.ir.calculations.map((c) => c.id),
        ...s.ir.validations.map((v) => v.id),
        ...s.ir.dataConnections.map((c) => c.id),
      ];
      expect([...ids].sort(), s.slug).toEqual([...want].sort());
      expect(new Set(ids).size, s.slug).toBe(ids.length);
    }
  });

  test('sentence counts over the 48 forms (logged); every item has a sentence', () => {
    const n = {
      rules: 0,
      calculations: 0,
      validations: 0,
      buttons: 0,
      onOpen: 0,
      connections: 0,
      depends: 0,
      unread: 0,
      fields: 0,
    };
    const undescribed: string[] = [];
    for (const s of samples) {
      const d = dossierOf(s);
      for (const k of ['rules', 'calculations', 'validations', 'buttons', 'onOpen'] as const)
        n[k] += d.logic[k].length;
      n.connections += d.connections.length;
      n.depends += d.depends.length;
      n.unread += d.unread.length;
      n.fields += d.fields.length;
      for (const i of allItems(d)) {
        expect(i.sentence.length, s.slug).toBeGreaterThan(10);
        if (/does not describe/.test(i.sentence)) undescribed.push(`${s.slug}: ${i.sentence}`);
      }
    }
    console.log(`P19 sentences: ${JSON.stringify(n)}; undescribed: ${JSON.stringify(undescribed)}`);
  });
});

test('R1.1, R2.1: section order; the same FormIR gives the same Markdown', () => {
  const s = samples.find((x) => x.slug.startsWith('04-'))!;
  const md = dossierMarkdown(dossierOf(s, 30));
  expect(dossierMarkdown(dossierOf(s, 30))).toBe(md);
  const heads = [...md.matchAll(/^#{1,3} (.*)$/gm)].map((m) => m[1]);
  expect(heads).toEqual([
    'Purchase Request: form documentation',
    'What the form is',
    'Fields',
    'Logic',
    'When the form opens',
    'Rules',
    'Calculations',
    'Validations',
    'Buttons',
    'Data connections',
    'What depends on what',
    'What could not be read',
  ]);
  expect(md).toContain('- **Records loaded:** 30');
});

test('form 04: rules, calculations and connections in words, expressions under them', () => {
  const d = dossierOf(samples.find((x) => x.slug.startsWith('04-'))!);
  const approval = d.logic.rules.find((r) => r.sentence.includes('Over 1000'))!;
  expect(approval.sentence).toBe(
    'Rule “Over 1000 needs accounting approval” runs when button CTRL901 on view “Request” is pressed, if a condition on Total incl. VAT is true: it sets Needs accounting approval to “true” and shows a message built from Total incl. VAT.',
  );
  expect(approval.expressions[0]).toBe('/my:purchaseRequest/my:grandTotal > 1000');
  expect(d.logic.calculations[0]!.sentence).toMatch(
    /^Line total is calculated in each row from Qty and Unit price/,
  );
  const sql = d.connections.find((c) => c.sentence.includes('Vendors'))!;
  expect(sql.sentence).toMatch(
    /is a database query on sql-legacy01; .* Cannot work: it needs a database on the old network\./,
  );
  const budget = d.connections.find((c) => c.sentence.includes('BudgetService'))!;
  expect(budget.sentence).toMatch(
    /Cannot work outside the old network: it calls internal host forms-legacy\./,
  );
});

describe('R3.4: Markdown escaping', () => {
  const HOSTILE =
    '[x](javascript:alert(1)) <img src=x onerror=alert(1)> **b** _i_ | c\n# H https://evil.example www.evil.example a@evil.example `code` &amp; ![p](q)';

  test('a hostile label, caption and message stay text', () => {
    const s = samples.find((x) => x.slug.startsWith('02-'))!;
    const ir: FormIR = {
      ...s.ir,
      meta: { ...s.ir.meta, name: HOSTILE },
      fields: s.ir.fields.map((f, i) => (i === 0 ? { ...f, label: HOSTILE, default: HOSTILE } : f)),
      rules: s.ir.rules.map((r) => ({ ...r, caption: HOSTILE })),
      validations: s.ir.validations.map((v) => ({
        ...v,
        message: { text: HOSTILE, shortMessage: HOSTILE },
      })),
    };
    const md = dossierMarkdown(buildDossier(ir, { fileName: 'x.xsn' }));
    // Our own markup: the bold "Label:" of the first section and `<sub>` around expressions.
    const outside = md
      .replace(/(?<!\\)(`+)[\s\S]*?(?<!`)\1(?!`)/g, '')
      .replace(/\*\*[A-Za-z ]+:\*\*|<\/?sub>/g, '');
    const bad = [...outside.matchAll(/(^|[^\\])[[\]<>*_!&]/gm)].map((m) =>
      outside.slice(Math.max(0, m.index - 30), m.index + 10),
    );
    expect(bad).toEqual([]);
    expect(outside).not.toMatch(/https?:\/\/|www\.|@/);
    expect(md.split('\n').filter((l) => l.startsWith('# '))).toHaveLength(1);
    expect(mdText(HOSTILE).includes('\n')).toBe(false);
  });

  test('property: no unescaped punctuation outside code spans, no line break, no link', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary-ascii' }), fc.boolean(), (s, table) => {
        const out = mdText(s, table);
        expect(out).not.toMatch(/[\r\n]/);
        // Read as CommonMark does: a backslash escapes the next character; an unescaped backtick
        // run opens a code span that the same run closes; any other punctuation is markup.
        const bare: string[] = [];
        for (let i = 0; i < out.length; i++) {
          const c = out[i]!;
          if (c === '\\') i++;
          else if (c === '`') {
            const run = /^`+/.exec(out.slice(i))![0];
            const end = out.indexOf(run, i + run.length);
            expect(end, out).toBeGreaterThan(i);
            i = end + run.length - 1;
          } else if (/[!-/:-@[-`{-~]/.test(c)) bare.push(c);
        }
        expect(bare, out).toEqual([]);
        if (table) expect(out.replace(/\\\|/g, '')).not.toContain('|');
      }),
      { numRuns: 500 },
    );
  });

  test('a code span holds backticks', () => {
    expect(mdCode('a`b')).toBe('``a`b``');
    expect(mdCode('`a')).toBe('`` `a ``');
  });
});
