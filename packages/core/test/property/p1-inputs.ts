// Inputs for property P1 (design §13.3, R19). Each arbitrary yields a small JSON descriptor and
// `materialize` turns it into bytes, so a shrunk counterexample can be pasted into
// regressions.ts as it is. Positions are plain integers taken modulo the current length, so they
// shrink towards the start of the input.

import fc from 'fast-check';
import { readCabinet, type PackageFile } from '../../src/index';
import { writeCabinet } from '../helpers/cab-writer';
import { readSample, sampleCabinets } from '../helpers/samples';

const MiB = 1024 * 1024;
const POS = fc.integer({ min: 0, max: 0x7fff_ffff });

// ---- Generator 1: random bytes (R19.1) ---------------------------------------------------------

export type BytesInput =
  /** fc.uint8Array as the design writes it; short arrays (fast-check's default size). */
  | { kind: 'given'; bytes: number[] }
  /** Up to 2 MiB from a seeded xorshift, optionally after `MSCF`, so lengths cover the range. */
  | { kind: 'filled'; length: number; seed: number; mscf: boolean };

export const bytesInput: fc.Arbitrary<BytesInput> = fc.oneof(
  fc
    .uint8Array({ maxLength: 2 * MiB })
    .map((b): BytesInput => ({ kind: 'given', bytes: Array.from(b) })),
  fc.record({
    kind: fc.constant('filled' as const),
    length: fc.integer({ min: 0, max: 2 * MiB }),
    seed: fc.integer(),
    mscf: fc.boolean(),
  }),
);

function materializeBytes(input: BytesInput): Uint8Array {
  if (input.kind === 'given') return Uint8Array.from(input.bytes);
  const out = new Uint8Array(input.length);
  let x = input.seed | 0 || 1;
  for (let i = 0; i < out.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  if (input.mscf) out.set([0x4d, 0x53, 0x43, 0x46].slice(0, out.length));
  return out;
}

// ---- Generator 2: mutated sample cabinets (R19.1) ----------------------------------------------

const cabinets = sampleCabinets().map((c) => ({ slug: c.slug, bytes: readSample(c.path) }));

export type CabMutation =
  | { op: 'flip'; at: number; bit: number }
  | { op: 'truncate'; at: number }
  /** The head of this cabinet up to `at`, then the tail of cabinet `other` from `from`. */
  | { op: 'splice'; other: number; at: number; from: number }
  /** A CFHEADER, first CFFOLDER, first CFFILE or first CFDATA field set to a boundary value. */
  | { op: 'field'; field: number; value: number };

export interface CabinetInput {
  cabinet: number;
  mutations: CabMutation[];
}

const mutation: fc.Arbitrary<CabMutation> = fc.oneof(
  fc.record({ op: fc.constant('flip' as const), at: POS, bit: fc.integer({ min: 0, max: 7 }) }),
  fc.record({ op: fc.constant('truncate' as const), at: POS }),
  fc.record({ op: fc.constant('splice' as const), other: POS, at: POS, from: POS }),
  fc.record({ op: fc.constant('field' as const), field: POS, value: POS }),
);

export const cabinetInput: fc.Arbitrary<CabinetInput> = fc.record({
  cabinet: fc.integer({ min: 0, max: cabinets.length - 1 }),
  mutations: fc.array(mutation, { minLength: 1, maxLength: 8 }),
});

/** [offset, width in bytes] of the fields named in design §6, for the original layout. */
function fieldsOf(cab: Uint8Array): [number, number][] {
  const v = new DataView(cab.buffer, cab.byteOffset, cab.byteLength);
  const header: [number, number][] = [
    [0, 4],
    [4, 4],
    [8, 4],
    [12, 4],
    [16, 4],
    [20, 4],
    [24, 1],
    [25, 1],
    [26, 2],
    [28, 2],
    [30, 2],
    [32, 2],
    [34, 2],
  ];
  const folder = 36; // no reserve area in any sample
  const coffFiles = cab.length >= 20 ? v.getUint32(16, true) : 0;
  const coffCabStart = cab.length >= 40 ? v.getUint32(folder, true) : 0;
  return [
    ...header,
    [folder, 4],
    [folder + 4, 2],
    [folder + 6, 2],
    [coffFiles, 4],
    [coffFiles + 4, 4],
    [coffFiles + 8, 2],
    [coffFiles + 10, 2],
    [coffFiles + 12, 2],
    [coffFiles + 14, 2],
    [coffCabStart, 4],
    [coffCabStart + 4, 2],
    [coffCabStart + 6, 2],
  ];
}

function boundaryValues(length: number): number[] {
  return [
    0,
    1,
    0x7f,
    0x80,
    0xff,
    0x100,
    0x7fff,
    0x8000,
    0xffff,
    0x1_0000,
    0x7fff_ffff,
    0x8000_0000,
    0xffff_ffff,
    length - 1,
    length,
    length + 1,
  ];
}

function materializeCabinet(input: CabinetInput): Uint8Array {
  const original = cabinets[input.cabinet % cabinets.length]!.bytes;
  const fields = fieldsOf(original);
  let b = Uint8Array.from(original);
  for (const m of input.mutations) {
    if (m.op === 'flip') {
      if (b.length) b[m.at % b.length]! ^= 1 << m.bit;
    } else if (m.op === 'truncate') {
      b = b.slice(0, m.at % (b.length + 1));
    } else if (m.op === 'splice') {
      const other = cabinets[m.other % cabinets.length]!.bytes;
      const head = b.slice(0, m.at % (b.length + 1));
      const tail = other.slice(m.from % (other.length + 1));
      b = new Uint8Array(head.length + tail.length);
      b.set(head);
      b.set(tail, head.length);
    } else {
      const [offset, width] = fields[m.field % fields.length]!;
      const values = boundaryValues(b.length);
      const value = values[m.value % values.length]! >>> 0;
      if (offset + width > b.length) continue;
      const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      if (width === 1) v.setUint8(offset, value & 0xff);
      else if (width === 2) v.setUint16(offset, value & 0xffff, true);
      else v.setUint32(offset, value, true);
    }
  }
  return b;
}

// ---- Generator 3: valid cabinets with mutated manifest or schema text (R19.2) ------------------

const packages: (readonly PackageFile[])[] = await Promise.all(
  cabinets.map(async (c) => (await readCabinet(c.bytes)).files),
);

export type TextMutation =
  | { op: 'dropTag'; at: number }
  | { op: 'insert'; at: number; text: string }
  | { op: 'duplicateAttribute'; at: number }
  /** `depth` nested `<n>` elements, inserted after the end of a tag. */
  | { op: 'nest'; at: number; depth: number };

export interface XmlInput {
  cabinet: number;
  /** Index among the package's `.xsf` and `.xsd` files. */
  file: number;
  mutations: TextMutation[];
}

const noise = fc.string({
  unit: fc.constantFrom(
    '<',
    '>',
    '/',
    '=',
    '"',
    "'",
    '&',
    ';',
    '#',
    '!',
    '?',
    '[',
    ']',
    '-',
    ':',
    ' ',
    '\n',
    'a',
    'x',
    'é',
    '\u0000',
    '\u0001',
    '\uFFFE',
    '\uD800',
    '<!DOCTYPE x>',
    '&#0;',
    ']]>',
    '<![CDATA[',
  ),
  maxLength: 12,
});

const textMutation: fc.Arbitrary<TextMutation> = fc.oneof(
  fc.record({ op: fc.constant('dropTag' as const), at: POS }),
  fc.record({ op: fc.constant('insert' as const), at: POS, text: noise }),
  fc.record({ op: fc.constant('duplicateAttribute' as const), at: POS }),
  fc.record({
    op: fc.constant('nest' as const),
    at: POS,
    depth: fc.oneof(fc.integer({ min: 1, max: 300 }), fc.integer({ min: 1, max: 5_000 })),
  }),
);

export const xmlInput: fc.Arbitrary<XmlInput> = fc.record({
  cabinet: fc.integer({ min: 0, max: cabinets.length - 1 }),
  file: POS,
  mutations: fc.array(textMutation, { minLength: 1, maxLength: 4 }),
});

function mutateText(text: string, m: TextMutation): string {
  const pick = <T>(xs: T[]) => (xs.length ? xs[m.at % xs.length] : undefined);
  if (m.op === 'insert') {
    const at = m.at % (text.length + 1);
    return text.slice(0, at) + m.text + text.slice(at);
  }
  if (m.op === 'dropTag') {
    const t = pick([...text.matchAll(/<[^>]*>/g)]);
    return t ? text.slice(0, t.index) + text.slice(t.index + t[0].length) : text;
  }
  if (m.op === 'duplicateAttribute') {
    const a = pick([...text.matchAll(/\s[A-Za-z_][\w:.-]*="[^"]*"/g)]);
    if (!a) return text;
    const end = a.index + a[0].length;
    return text.slice(0, end) + a[0] + text.slice(end);
  }
  const ends = [...text.matchAll(/>/g)].map((x) => x.index + 1);
  const at = pick(ends);
  if (at === undefined) return text;
  return text.slice(0, at) + '<n>'.repeat(m.depth) + '</n>'.repeat(m.depth) + text.slice(at);
}

function materializeXml(input: XmlInput): Uint8Array {
  const files = packages[input.cabinet % packages.length]!;
  const xml = files.flatMap((f, i) => (/\.(xsf|xsd)$/i.test(f.name) ? [i] : []));
  const target = xml[input.file % xml.length]!;
  return writeCabinet(
    files.map((f, i) => {
      let bytes = f.bytes;
      if (i === target) {
        let text = new TextDecoder().decode(f.bytes);
        for (const m of input.mutations) text = mutateText(text, m);
        bytes = new TextEncoder().encode(text);
      }
      return { name: f.name, bytes, attributes: f.attributes, date: f.date, time: f.time };
    }),
  ).bytes;
}

// ---- All three ---------------------------------------------------------------------------------

export type Generator = 'bytes' | 'cabinet' | 'xml';
export type P1Input =
  | { generator: 'bytes'; input: BytesInput }
  | { generator: 'cabinet'; input: CabinetInput }
  | { generator: 'xml'; input: XmlInput };

export function materialize(p: P1Input): Uint8Array {
  if (p.generator === 'bytes') return materializeBytes(p.input);
  if (p.generator === 'cabinet') return materializeCabinet(p.input);
  return materializeXml(p.input);
}
