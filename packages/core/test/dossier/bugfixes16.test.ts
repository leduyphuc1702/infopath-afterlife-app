// Spec 16: bugs in the dossier (K2–K4, K6, K9–K11) and an honest open (K13), each failing
// before its fix.
import fc from 'fast-check';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  buildDossier,
  buttonCaptions,
  conditionWords,
  dossierMarkdown,
  FillSession,
  mdText,
  parseXsn,
  traceSentence,
  type Dossier,
  type FormIR,
  type ParsedTemplate,
} from '../../src/index';
import { readSample, sampleCabinets } from '../helpers/samples';
import { sampleIRs, type SampleIR } from '../helpers/irs';

let samples: SampleIR[];
let parsed04: ParsedTemplate;
beforeAll(async () => {
  samples = await sampleIRs();
  parsed04 = await parseXsn(
    readSample(sampleCabinets().find((c) => c.slug.startsWith('04-'))!.path),
  );
}, 60_000);
const of = (prefix: string) => samples.find((s) => s.slug.startsWith(prefix))!;
const dossier = (s: SampleIR, buttons?: ReadonlyMap<string, string>): Dossier =>
  buildDossier(s.ir, { fileName: s.fileName, ...(buttons && { buttons }) });
const sentences = (d: Dossier) =>
  [
    ...d.logic.onOpen,
    ...d.logic.rules,
    ...d.logic.calculations,
    ...d.logic.validations,
    ...d.logic.buttons,
    ...d.connections,
    ...d.depends,
  ].map((i) => i.sentence);

test('K2: a button is named by the caption its view shows', () => {
  const captions = buttonCaptions(parsed04);
  expect(captions.get('CTRL900')).toBe('Check budget');
  const d = dossier(of('04-'), captions);
  expect(d.logic.buttons.map((b) => b.sentence)).toEqual([
    'The button “Check budget” on view “Request” runs the rule “Query budget service”.',
    'The button “Check approval” on view “Request” runs the rules “Over 1000 needs accounting approval” and “1000 or less”.',
  ]);
  expect(sentences(d).join('\n')).not.toMatch(/CTRL\d/);
});

test('K2: Rule Trace names the button pressed', () => {
  const s = FillSession.open(parsed04, of('04-').ir, { now: '2026-11-11T09:00:00+07:00' });
  const a = s.press('CTRL901');
  const rule = a.trace.find((e) => e.kind === 'rule' && e.condition === true)!;
  expect(traceSentence(of('04-').ir, rule)).toMatch(
    /^Rule “.*” ran because “Check approval” was pressed/,
  );
});

test('K3: Required is what a person filling in the form meets', () => {
  const d = dossier(of('04-'));
  const req = d.fields.filter((f) => f.required).map((f) => f.label);
  expect(req).toEqual(['Name', 'Justification']);
});

describe('K4: conditions in words', () => {
  test('form 04 and others', () => {
    const d = dossier(of('04-'));
    expect(d.logic.rules[1]!.sentence).toContain('if Total incl. VAT is greater than 1000:');
    expect(d.logic.rules[2]!.sentence).toContain('if Total incl. VAT is 1000 or less:');
    expect(d.logic.validations.map((v) => v.sentence)).toEqual([
      'Name is marked “Cannot be blank” when it is blank. Its full message: “This field is required.”',
      'Justification is marked “Cannot be blank” when it is blank. Its full message: “This field is required.”',
      'Qty is marked “At least 1” when it is less than 1. Its full message: “Quantity must be at least 1.”',
    ]);
    const ir = of('04-').ir;
    expect(conditionWords(ir, '. < 1 or . > 10', 'it')).toBe(
      'it is less than 1 or it is greater than 10',
    );
    expect(conditionWords(ir, 'not(string(my:requestDate))', 'it')).toBe('requestDate is blank');
    expect(conditionWords(ir, 'msxsl:string-compare(., ../my:subtotal) < 0', 'it')).toBe(
      'it comes before Subtotal',
    );
    expect(conditionWords(ir, 'not(. > 3) and ../my:vatRate != ""', 'it')).toBe(
      'it is 3 or less and VAT rate is not blank',
    );
    expect(conditionWords(ir, 'count(../x[@a = 1]) > 2', 'it')).toBeUndefined();
  });

  test('share put in words over the 48 forms (logged)', () => {
    let all = 0;
    let words = 0;
    for (const s of samples) {
      const conds = [
        ...s.ir.rules.flatMap((r) => (r.condition ? [r.condition] : [])),
        ...s.ir.validations.flatMap((v) => (v.expression ? [v.expression] : [])),
      ];
      all += conds.length;
      words += conds.filter((c) => conditionWords(s.ir, c, 'it') !== undefined).length;
    }
    console.log(`K4: ${words} of ${all} conditions in words`);
    expect(words).toBe(all);
  });
});

describe('K6: Markdown escapes only what could become markup', () => {
  test('ordinary text stays readable', () => {
    // Spec 19 P3a: a dotted name (here a file name) is a code span, since some renderers link it.
    expect(mdText('04-purchase-request.xsn, version 1.0.0.1, Yes/No (a: b)')).toBe(
      '`04-purchase-request.xsn`, version 1.0.0.1, Yes/No (a: b)',
    );
    expect(mdText('my_field_name')).toBe('my_field_name');
    expect(mdText('# 1. - > text')).toBe('\\# 1. - > text');
    expect(mdText('*b* _i_ [x](y) <b> &amp; ~s~')).toBe(
      '\\*b\\* \\_i\\_ \\[x\\](y) \\<b> \\&amp; \\~s\\~',
    );
  });

  test('property: unescaping gives the text back; nothing left can be markup', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary-ascii' }), fc.boolean(), (s, table) => {
        const out = mdText(s, table);
        expect(out).not.toMatch(/[\r\n]/);
        let plain = '';
        let bare = '';
        for (let i = 0; i < out.length; i++) {
          const c = out[i]!;
          if (c === '\\' && /[!-/:-@[-`{-~]/.test(out[i + 1] ?? '')) {
            plain += out[++i];
            bare += 'x';
          } else if (c === '`') {
            const run = /^`+/.exec(out.slice(i))![0];
            const end = out.indexOf(run, i + run.length);
            expect(end, out).toBeGreaterThan(i);
            let body = out.slice(i + run.length, end);
            if (body.startsWith(' ') && body.endsWith(' ') && body.trim() !== '')
              body = body.slice(1, -1);
            plain += table ? body.replace(/\\\|/g, '|') : body;
            bare += 'x';
            i = end + run.length - 1;
          } else {
            plain += c;
            bare += c;
          }
        }
        // Spec 19 P3b: leading white space is dropped (it would start a code block).
        expect(plain).toBe(s.replace(/[\r\n\t\f\v]+/g, ' ').replace(/^\s+/, ''));
        expect(bare).not.toMatch(/[*[\]<`~\\]|&#?\w+;/);
        expect(bare).not.toMatch(/(^|[^A-Za-z0-9])_|_($|[^A-Za-z0-9])/);
        expect(bare).not.toMatch(/^\s*([#>+=-]|\d+[.)])/);
        if (table) expect(bare).not.toContain('|');
      }),
      { numRuns: 1000 },
    );
  });
});

test('K9, K10: each connection kind says what is known, in words', () => {
  const all = samples.flatMap((s) => dossier(s).connections.map((c) => c.sentence));
  expect(all).toHaveLength(8);
  for (const c of all) {
    expect(c).not.toMatch(/Not known/);
    expect(c).not.toMatch(/\b(Manual|Unsupported|Native):/);
  }
});

test('K11: a node without a label is named in words, its path under the sentence', () => {
  const s = of('04-');
  const subtotal = s.ir.fields.find((f) => f.path.endsWith('/my:subtotal'))!;
  const ir: FormIR = { ...s.ir, fields: s.ir.fields.filter((f) => f.id !== subtotal.id) };
  const d = buildDossier(ir, { fileName: s.fileName });
  const vat = d.logic.calculations.find((c) => c.sentence.startsWith('VAT'))!;
  expect(vat.sentence).toBe(
    'VAT is calculated from subtotal and VAT rate, again whenever they change.',
  );
  expect(vat.expressions).toContain('/my:purchaseRequest/my:subtotal');
  for (const t of sentences(d)) expect(t).not.toMatch(/[a-z]+:\/[a-z]+:|\/my:/);
  expect(dossierMarkdown(d)).toBeTruthy();
});

test('K13: a stored value that disagrees with the formula is said as such at open', () => {
  const c = sampleCabinets().find((x) => x.slug.startsWith('04-'))!;
  const rec = readSample(
    c.path.replace(
      /xsn\/04-purchase-request\.xsn$/,
      'records/04-purchase-request/04-purchase-request-004.xml',
    ),
  );
  const s = FillSession.open(parsed04, of('04-').ir, {
    now: '2026-11-11T09:00:00+07:00',
    record: rec,
  });
  const words = s.opened.trace
    .filter((e) => e.kind === 'calc')
    .map((e) => traceSentence(of('04-').ir, e));
  expect(words).toEqual([
    'VAT in the record (629.12) does not match the form’s formula, which gives 629.13; the form’s value is shown.',
    'Total incl. VAT in the record (6920.37) does not match the form’s formula, which gives 6920.38; the form’s value is shown.',
  ]);
});
