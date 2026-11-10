// Inputs of property P13 (spec 02 design §10, R12): one calculated field added to a sample's
// ParsedTemplate as a Modelled object (no XML), whose expression mixes inserted field references
// with operators, function calls, numbers and string literals holding path-like text.

import fc from 'fast-check';
import type { IrField } from '../../src/index';

export type RefForm = 'absolute' | 'relative' | 'predicate' | 'getDom';
export type Wrap = 'none' | 'nz' | 'sum' | 'concat';
export type Op = '+' | 'div' | 'and' | '=';

export interface P13Input {
  /** Index into the samples, modulo their number. */
  readonly sample: number;
  /** Index into the eligible main fields: the calculation target. */
  readonly target: number;
  readonly refs: readonly { readonly pick: number; readonly form: RefForm; readonly wrap: Wrap }[];
  readonly ops: readonly Op[];
  /** Numbers, and string literals holding the path of a field (index) that is not inserted. */
  readonly extras: readonly ({ readonly n: number } | { readonly literal: number })[];
}

export const p13Input: fc.Arbitrary<P13Input> = fc.record({
  sample: fc.nat(),
  target: fc.nat(),
  refs: fc.array(
    fc.record({
      pick: fc.nat(),
      form: fc.constantFrom<RefForm>('absolute', 'relative', 'predicate', 'getDom'),
      wrap: fc.constantFrom<Wrap>('none', 'nz', 'sum', 'concat'),
    }),
    { minLength: 1, maxLength: 4 },
  ),
  ops: fc.array(fc.constantFrom<Op>('+', 'div', 'and', '='), { minLength: 8, maxLength: 8 }),
  extras: fc.array(
    fc.oneof(fc.record({ n: fc.integer({ min: 0, max: 999 }) }), fc.record({ literal: fc.nat() })),
    { maxLength: 3 },
  ),
});

/** Fields whose data path the tokenizer can read (no `{uri}local` step). */
export const eligible = (fields: readonly IrField[]) => fields.filter((f) => !f.path.includes('{'));

const steps = (p: string) => p.split('/').slice(1);

/** `to` written relative to `from`: `..` up to the common ancestor, then down. */
export function relative(from: string, to: string): string {
  const a = steps(from);
  const b = steps(to);
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  const parts = [...Array<string>(a.length - k).fill('..'), ...b.slice(k)];
  return parts.length ? parts.join('/') : '.';
}

export interface Built {
  readonly target: IrField;
  readonly expression: string;
  readonly inserted: readonly IrField[];
  readonly literalOnly: readonly IrField[];
}

/** The expression for `input` over one sample's FormIR fields (built without the calculation). */
export function build(input: P13Input, fields: readonly IrField[]): Built {
  const main = eligible(fields.filter((f) => f.dataSource === 'main'));
  const secondary = eligible(fields.filter((f) => f.dataSource !== 'main'));
  const target = main[input.target % main.length]!;
  const inserted: IrField[] = [];
  const terms = input.refs.map((r) => {
    let text: string;
    let f: IrField;
    if (r.form === 'getDom' && secondary.length) {
      f = secondary[r.pick % secondary.length]!;
      text = `xdXDocument:GetDOM("${f.dataSource}")${f.path}`;
    } else {
      f = main[r.pick % main.length]!;
      const s = steps(f.path);
      if (r.form === 'relative') text = relative(target.path, f.path);
      else if (r.form === 'predicate' && s.length > 1)
        text = `/${s[0]}[${s.slice(1).join('/')} != ""]`;
      else text = f.path;
    }
    inserted.push(f);
    switch (r.wrap) {
      case 'nz':
        return `xdMath:Nz(${text})`;
      case 'sum':
        return `sum(${text})`;
      case 'concat':
        return `concat(${text}, "x")`;
      default:
        return text;
    }
  });
  const used = new Set([target.id, ...inserted.map((f) => f.id)]);
  const free = main.filter((f) => !used.has(f.id));
  const literalOnly: IrField[] = [];
  for (const e of input.extras) {
    if ('n' in e) terms.push(String(e.n));
    else if (free.length) {
      const f = free[e.literal % free.length]!;
      literalOnly.push(f);
      terms.push(`"${f.path}"`);
    }
  }
  const expression = terms
    .map((t, i) => (i === 0 ? t : ` ${input.ops[(i - 1) % input.ops.length]} ${t}`))
    .join('');
  return { target, expression, inserted, literalOnly };
}
