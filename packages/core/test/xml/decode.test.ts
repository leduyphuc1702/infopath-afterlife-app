import { describe, expect, test } from 'vitest';
import { decode } from '../../src/xml/decode';
import { REFUSED_ENCODINGS } from '../../src/xml/refused-encodings';
import { catchError } from '../helpers/catch-error';
import { encode } from '../helpers/encode';

// R5.3, D11, design §7.2 step 1.

const decl = (enc?: string) =>
  enc === undefined ? '<?xml version="1.0"?>' : `<?xml version="1.0" encoding="${enc}"?>`;
const doc = (enc: string | undefined, body: string) => `${decl(enc)}\n<root>${body}</root>`;

describe('UTF-8 and UTF-16', () => {
  test('UTF-8 without a BOM, declared or not', () => {
    for (const enc of [undefined, 'UTF-8', 'utf8']) {
      const text = doc(enc, 'Ärger €');
      expect(decode(encode(text, 'utf-8'), 'a.xml')).toEqual({
        text,
        encoding: 'utf-8',
        issues: [],
      });
    }
  });

  test('UTF-8 with a BOM: the BOM is dropped', () => {
    const text = doc('utf-8', 'x');
    expect(decode(encode(text, 'utf-8', true), 'a.xml').text).toBe(text);
  });

  test.each(['utf-16le', 'utf-16be'] as const)('%s with a BOM', (enc) => {
    const text = doc('utf-16', 'Привет 日本');
    expect(decode(encode(text, enc, true), 'a.xml')).toEqual({ text, encoding: enc, issues: [] });
  });

  test.each(['utf-16le', 'utf-16be'] as const)('%s without a BOM, from the bytes of <?', (enc) => {
    const text = doc('UTF-16', 'Привет');
    expect(decode(encode(text, enc), 'a.xml')).toEqual({ text, encoding: enc, issues: [] });
  });

  test('a BOM wins over the declaration', () => {
    const text = doc('windows-1252', 'é');
    expect(decode(encode(text, 'utf-8', true), 'a.xml').encoding).toBe('utf-8');
    expect(decode(encode(text, 'utf-16le', true), 'a.xml').encoding).toBe('utf-16le');
  });

  test('a declared UTF-16 label on ASCII-compatible bytes is read as UTF-8', () => {
    const text = doc('UTF-16', 'é');
    expect(decode(encode(text, 'utf-8'), 'a.xml')).toEqual({ text, encoding: 'utf-8', issues: [] });
  });

  test('single-quoted declaration and extra whitespace', () => {
    const text = "<?xml version='1.0'   encoding = 'windows-1251' ?><r>Ж</r>";
    expect(decode(encode(text, 'windows-1251'), 'a.xml').text).toBe(text);
  });
});

describe('legacy code pages (decoded, not refused)', () => {
  test.each([
    ['windows-1251', 'Заявка на отпуск: Ёжик', 'windows-1251'],
    ['windows-1252', 'Café – naïve ‘quote’ €5', 'windows-1252'],
    ['iso-8859-1', 'Übersicht ÿ', 'windows-1252'], // WHATWG maps the label to windows-1252
    ['shift_jis', '日本語 申請', 'shift_jis'],
  ] as const)('%s', (label, body, canonical) => {
    const text = doc(label, body);
    expect(decode(encode(text, label), 'a.xml')).toEqual({ text, encoding: canonical, issues: [] });
  });
});

describe('refused labels → INVALID_XML naming the label', () => {
  test.each(['x-made-up', 'iso-2022-kr', 'replacement', ...REFUSED_ENCODINGS])('%s', (label) => {
    const text = doc(label, 'x');
    expect(catchError(() => decode(encode(text, 'utf-8'), 'schema.xsd'))).toMatchObject({
      code: 'INVALID_XML',
      details: { file: 'schema.xsd', line: 1, column: 31, encoding: label },
    });
  });
});

describe('damaged bytes', () => {
  test('invalid UTF-8 gives U+FFFD and INVALID_ENCODING, not an error', () => {
    const bytes = new Uint8Array([
      ...encode('<r>a', 'utf-8'),
      0xff,
      0xc3,
      ...encode('b</r>', 'utf-8'),
    ]);
    const result = decode(bytes, 'view1.xsl');
    expect(result.text).toBe('<r>a\ufffd\ufffdb</r>');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'INVALID_ENCODING',
        file: 'view1.xsl',
        details: { encoding: 'utf-8' },
      }),
    ]);
  });

  test('an unpaired UTF-16 surrogate is replaced too', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x00, 0xd8, 0x3e, 0x00]);
    const result = decode(bytes, 'a.xml');
    expect(result.text).toBe('<\ufffd>');
    expect(result.issues.map((i) => i.code)).toEqual(['INVALID_ENCODING']);
  });
});
