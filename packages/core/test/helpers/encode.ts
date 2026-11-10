// Writes encoded XML fixtures from UTF-8 source strings, so no binary encoding file is committed
// (design §13.1). UTF-8 uses TextEncoder; UTF-16 is written code unit by code unit; the legacy
// encodings use small fixed tables covering only the characters the tests use.

export type FixtureEncoding =
  'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1251' | 'windows-1252' | 'iso-8859-1' | 'shift_jis';

const CYRILLIC_1251: Record<string, number> = { Ё: 0xa8, ё: 0xb8 };
for (let c = 0x410; c <= 0x44f; c++) CYRILLIC_1251[String.fromCharCode(c)] = 0xc0 + (c - 0x410);

const WINDOWS_1252: Record<string, number> = {
  '€': 0x80,
  '–': 0x96,
  '‘': 0x91,
  '’': 0x92,
  Ÿ: 0x9f,
};
for (let c = 0xa0; c <= 0xff; c++) WINDOWS_1252[String.fromCharCode(c)] = c;

const LATIN_1: Record<string, number> = {};
for (let c = 0xa0; c <= 0xff; c++) LATIN_1[String.fromCharCode(c)] = c;

// Shift_JIS (JIS X 0208), two bytes each.
const SHIFT_JIS: Record<string, [number, number]> = {
  日: [0x93, 0xfa],
  本: [0x96, 0x7b],
  語: [0x8c, 0xea],
  申: [0x90, 0x5c],
  請: [0x90, 0xbf],
};

export function encode(text: string, encoding: FixtureEncoding, bom = false): Uint8Array {
  switch (encoding) {
    case 'utf-8': {
      const body = new TextEncoder().encode(text);
      return bom ? new Uint8Array([0xef, 0xbb, 0xbf, ...body]) : body;
    }
    case 'utf-16le':
    case 'utf-16be': {
      const le = encoding === 'utf-16le';
      const out = new Uint8Array((text.length + (bom ? 1 : 0)) * 2);
      const units = bom ? '\ufeff' + text : text;
      for (let i = 0; i < units.length; i++) {
        const u = units.charCodeAt(i);
        out[2 * i + (le ? 0 : 1)] = u & 0xff;
        out[2 * i + (le ? 1 : 0)] = u >> 8;
      }
      return out;
    }
    case 'windows-1251':
      return singleByte(text, CYRILLIC_1251, encoding);
    case 'windows-1252':
      return singleByte(text, WINDOWS_1252, encoding);
    case 'iso-8859-1':
      return singleByte(text, LATIN_1, encoding);
    case 'shift_jis': {
      const out: number[] = [];
      for (const ch of text) {
        if (ch.charCodeAt(0) < 0x80) out.push(ch.charCodeAt(0));
        else if (SHIFT_JIS[ch]) out.push(...SHIFT_JIS[ch]);
        else throw new Error(`no Shift_JIS bytes for ${ch} in the test table`);
      }
      return Uint8Array.from(out);
    }
  }
}

function singleByte(text: string, table: Record<string, number>, name: string): Uint8Array {
  return Uint8Array.from(text, (ch) => {
    const c = ch.charCodeAt(0);
    if (c < 0x80) return c;
    const b = table[ch];
    if (b === undefined) throw new Error(`no ${name} byte for ${ch} in the test table`);
    return b;
  });
}
