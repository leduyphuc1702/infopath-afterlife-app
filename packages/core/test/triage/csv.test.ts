import { expect, test } from 'vitest';
import { CSV_COLUMNS, csvCell, toCsv, triageFiles } from '../../src/index';
import { readSample, repoRoot } from '../helpers/samples';

// Spec 12 R5.1: RFC 4180, CRLF, one row per form, injection-safe cells.
const xsn = (slug: string) => ({
  name: `${slug}.xsn`,
  bytes: readSample(`${repoRoot}samples/own/xsn/${slug}.xsn`),
});

test('cells: quotes, commas, line breaks, formulas (OWASP, with tab and carriage return)', () => {
  expect(csvCell('plain')).toBe('plain');
  expect(csvCell('a,b')).toBe('"a,b"');
  expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  expect(csvCell('two\nlines')).toBe('"two\nlines"');
  for (const lead of ['=', '+', '-', '@', '\t', '\r'])
    expect(csvCell(`${lead}1+1`)[0 + (lead === '\r' ? 1 : 0)]).toMatch(/['"]/);
  expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
  expect(csvCell('\tx')).toBe("'\tx");
  expect(csvCell('\rx')).toBe(`"'\rx"`);
  expect(csvCell(undefined)).toBe('');
  expect(csvCell(true)).toBe('yes');
  expect(csvCell(0)).toBe('0');
});

test('one row per form and per error, header first, CRLF; Emulated in the header', async () => {
  const res = await triageFiles([
    xsn('04-purchase-request'),
    xsn('46-vendor-onboarding-code'),
    { name: '=evil.xsn', bytes: new Uint8Array(10) },
  ]);
  const csv = toCsv(res);
  expect(csv.endsWith('\r\n')).toBe(true);
  const lines = csv.slice(0, -2).split('\r\n');
  expect(lines).toHaveLength(1 + 3);
  expect(lines[0]).toBe(CSV_COLUMNS.join(','));
  expect(lines[0]).toContain('Emulated');
  expect(lines[0]).not.toContain('App');
  for (const l of lines) expect(l.split(',').length).toBe(CSV_COLUMNS.length);
  expect(lines[3]).toBe(`'=evil.xsn${','.repeat(CSV_COLUMNS.length - 1)}CORRUPT_CAB`);
  expect(lines.find((l) => l.startsWith('46-'))).toContain(
    'infopath-client internal-service code-behind',
  );
});
