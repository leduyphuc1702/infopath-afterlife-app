import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { AfterlifeError, readZip, writeZip } from '../../src/index';
import { crc32 } from '../../src/zip/crc32';

// Spec 09 R12.5, R12.6: the zip writer and the hostile-input reader, by example.
const text = (s: string) => new TextEncoder().encode(s);
const codeOf = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return e instanceof AfterlifeError
      ? `${e.code}${'feature' in e.details ? ` ${String(e.details.feature)}` : ''}`
      : String(e);
  }
  return 'no error';
};

/** A one-entry archive written by hand, so each field can be set to what a test needs. */
function handZip(o: {
  name?: string;
  data?: Uint8Array;
  size?: number;
  method?: number;
  flags?: number;
  disk?: number;
  crc?: number;
}): Uint8Array {
  const name = text(o.name ?? 'a.xml');
  const raw = o.data ?? text('hello');
  const method = o.method ?? 0;
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const size = o.size ?? raw.length;
  const crc = o.crc ?? crc32(raw);
  const loc = new DataView(new ArrayBuffer(30));
  loc.setUint32(0, 0x04034b50, true);
  loc.setUint16(8, method, true);
  loc.setUint16(26, name.length, true);
  const cen = new DataView(new ArrayBuffer(46));
  cen.setUint32(0, 0x02014b50, true);
  cen.setUint16(8, o.flags ?? 0, true);
  cen.setUint16(10, method, true);
  cen.setUint32(16, crc, true);
  cen.setUint32(20, data.length, true);
  cen.setUint32(24, size, true);
  cen.setUint16(28, name.length, true);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, o.disk ?? 0, true);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, 46 + name.length, true);
  end.setUint32(16, 30 + name.length + data.length, true);
  const parts = [
    new Uint8Array(loc.buffer),
    name,
    data,
    new Uint8Array(cen.buffer),
    name,
    new Uint8Array(end.buffer),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

test('stored and deflate entries written by zlib are read back', async () => {
  for (const method of [0, 8]) {
    const [e] = readZip(handZip({ method, data: text('<r>'.repeat(500)) }));
    expect(new TextDecoder().decode(await e!.read())).toBe('<r>'.repeat(500));
  }
});

test('the writer deflates what shrinks and stores what does not; UTF-8 names', async () => {
  const zip = await writeZip([
    { name: 'Hồ sơ/a.csv', bytes: text('x,'.repeat(1000)) },
    { name: 'b.bin', bytes: new Uint8Array([7]) },
  ]);
  const v = new DataView(zip.buffer);
  expect(v.getUint16(8, true)).toBe(8);
  expect(v.getUint16(6, true)).toBe(0x0800);
  const [a, b] = readZip(zip);
  expect(a!.name).toBe('Hồ sơ/a.csv');
  expect(a!.compressedSize).toBeLessThan(a!.size);
  expect(b!.compressedSize).toBe(1);
});

test('refused: ZIP64, encryption, other methods, multi-disk', () => {
  expect(codeOf(() => readZip(handZip({ flags: 1 })))).toBe('UNSUPPORTED_ZIP encryption');
  expect(codeOf(() => readZip(handZip({ method: 14 })))).toBe('UNSUPPORTED_ZIP method');
  expect(codeOf(() => readZip(handZip({ disk: 1 })))).toBe('UNSUPPORTED_ZIP multiDisk');
  expect(codeOf(() => readZip(handZip({ size: 0xffffffff, method: 8 })))).toBe(
    'UNSUPPORTED_ZIP zip64',
  );
});

test('names that leave their folder make the archive corrupt; others are normalised', () => {
  for (const name of [
    '../evil.xml',
    'a/../../b.xml',
    '/etc/passwd',
    'C:\\x.xml',
    'a\u0001.xml',
    '..\\b.xml',
  ])
    expect(
      codeOf(() => readZip(handZip({ name }))),
      name,
    ).toBe('CORRUPT_ZIP');
  expect(readZip(handZip({ name: 'lib\\./forms//a.xml' }))[0]!.name).toBe('lib/forms/a.xml');
});

test('limits: a bomb ratio, the declared total and the entry count are checked before inflating', () => {
  const zeros = new Uint8Array(2 * 1024 * 1024);
  expect(codeOf(() => readZip(handZip({ method: 8, data: zeros })))).toBe('LIMIT_EXCEEDED');
  expect(
    codeOf(() => readZip(handZip({ data: text('abc') }), { limits: { uncompressedBytes: 2 } })),
  ).toBe('LIMIT_EXCEEDED');
  expect(codeOf(() => readZip(handZip({}), { limits: { entries: 0 } }))).toBe('LIMIT_EXCEEDED');
});

test('an entry that lies about its size or CRC fails when read', async () => {
  const big = readZip(handZip({ method: 8, data: text('a'.repeat(100)), size: 10 }))[0]!;
  await expect(big.read()).rejects.toMatchObject({ code: 'CORRUPT_ZIP' });
  const bad = readZip(handZip({ crc: 1 }))[0]!;
  await expect(bad.read()).rejects.toMatchObject({ code: 'CORRUPT_ZIP' });
  expect(codeOf(() => readZip(text('PK not a zip')))).toBe('CORRUPT_ZIP');
});

test('the system unzip accepts what the writer writes (skipped without unzip)', async (ctx) => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
  } catch {
    ctx.skip();
  }
  const dir = mkdtempSync(join(tmpdir(), 'afl-zip-'));
  const file = join(dir, 'x.zip');
  writeFileSync(
    file,
    await writeZip([
      { name: 'a/b.txt', bytes: text('hello '.repeat(99)) },
      { name: 'c', bytes: new Uint8Array(0) },
    ]),
  );
  expect(execFileSync('unzip', ['-t', file]).toString()).toContain('No errors detected');
});
