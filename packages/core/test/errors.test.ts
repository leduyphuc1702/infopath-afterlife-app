import { expect, test } from 'vitest';
import { AfterlifeError, ERROR_CODES, type ErrorDetailsByCode } from '../src/errors';

// Design §11: codes, details, instanceof and an English message.

const samples: { [C in keyof ErrorDetailsByCode]: ErrorDetailsByCode[C] } = {
  UNSUPPORTED_COMPRESSION: { method: 'LZX', folder: 0 },
  UNSUPPORTED_CAB: { feature: 'nextCabinet' },
  CORRUPT_CAB: { offset: 36, reason: 'u32 at offset 36 lies outside the 37-byte input' },
  CORRUPT_ZIP: { offset: 0, reason: 'no end of central directory record' },
  UNSUPPORTED_ZIP: { feature: 'method', method: 14 },
  LIMIT_EXCEEDED: { limit: 'entries', max: 2000, observed: 2001 },
  MISSING_MANIFEST: { names: 'a.xsf,b.xsf' },
  UNSAFE_XML: { file: 'manifest.xsf', line: 2, column: 1 },
  INVALID_XML: { file: 'schema.xsd', line: 1, column: 31, encoding: 'iso-2022-kr' },
  INTERNAL: { path: '/xsf:xDocumentClass[1]/xsf:views[1]', reason: 'not consumed by a builder' },
  INVALID_IR: { path: '$.fields[0].kind', reason: 'expected one of field, richText' },
  UNSUPPORTED_IR_VERSION: { found: '2' },
  RENDER_FAILED: { view: 'View 1', xsltCode: 'XTSE0010', message: 'xsl:stylesheet has no version' },
  VIEW_NOT_RENDERABLE: { view: 'Manager', reason: 'unknown' },
  INVALID_RENDER_INPUT: { field: 'now', value: '2026-11-10' },
};

test('the code list matches design §11', () => {
  expect([...ERROR_CODES].sort()).toEqual(Object.keys(samples).sort());
});

test.each(ERROR_CODES)('%s keeps its code and details and is an Error', (code) => {
  const details = samples[code];
  const err = new AfterlifeError(code, details);
  expect(err).toBeInstanceOf(AfterlifeError);
  expect(err).toBeInstanceOf(Error);
  expect(err.name).toBe('AfterlifeError');
  expect(err.code).toBe(code);
  expect(err.details).toEqual(details);
  expect(Object.isFrozen(err.details)).toBe(true);
  expect(err.message).toMatch(/^[\x20-\x7e]+$/);
});

test('messages name the important detail', () => {
  expect(new AfterlifeError('CORRUPT_CAB', { offset: 12, reason: 'x' }).message).toBe(
    'Corrupt cabinet at offset 12: x',
  );
  expect(
    new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'xmlDepth',
      max: 256,
      observed: 257,
      file: 'a.xsd',
    }).message,
  ).toBe('Limit xmlDepth exceeded: 257 > 256 in a.xsd');
  expect(new AfterlifeError('UNSUPPORTED_COMPRESSION', { method: 7, folder: 2 }).message).toBe(
    'Folder 2 uses unsupported compression 7',
  );
});

test('INTERNAL names the path and the broken invariant', () => {
  expect(new AfterlifeError('INTERNAL', { path: '/a[1]', reason: 'not consumed' }).message).toBe(
    'Internal error at /a[1]: not consumed',
  );
});

test('RENDER_FAILED keeps the message printable ASCII', () => {
  expect(
    new AfterlifeError('RENDER_FAILED', {
      view: 'View 1',
      xsltCode: 'XPTY0004',
      message: 'Unknown function \u00e9',
      line: 3,
    }).message,
  ).toBe('View View 1 failed to render (XPTY0004) at line 3: Unknown function ?');
});

test('details are copied, so changing the input later does not change the error', () => {
  const details = { offset: 1, reason: 'r' };
  const err = new AfterlifeError('CORRUPT_CAB', details);
  details.offset = 99;
  expect(err.details.offset).toBe(1);
});
