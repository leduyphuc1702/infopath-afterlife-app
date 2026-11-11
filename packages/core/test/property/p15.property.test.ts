import fc from 'fast-check';
import { expect, test } from 'vitest';
import { AfterlifeError, readZip, writeZip } from '../../src/index';

// Property P15 (spec 09 R12.5, R12.6): for any list of entries, reading what the writer wrote
// gives the same names and bytes; and for any mutation of a written archive, the reader returns
// entries or rejects with CORRUPT_ZIP, UNSUPPORTED_ZIP or LIMIT_EXCEEDED, within 1 s, and never
// yields a name that is absolute or has a `..` segment.

const segment = fc.stringMatching(/^[\w é-]{1,12}$/);
const entry = fc.record({
  name: fc.array(segment, { minLength: 1, maxLength: 3 }).map((s) => s.join('/')),
  bytes: fc.oneof(
    fc.uint8Array({ maxLength: 2_000 }),
    fc.string({ maxLength: 3_000 }).map((s) => new TextEncoder().encode(s.repeat(3))),
  ),
});

test('P15: read(write(x)) gives the same names and bytes', async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(entry, { maxLength: 8 }), async (list) => {
      const zip = await writeZip(list);
      const back = readZip(zip);
      expect(back.map((e) => e.name)).toEqual(list.map((e) => e.name));
      for (const [i, e] of back.entries()) expect(await e.read()).toEqual(list[i]!.bytes);
    }),
    { numRuns: 200 },
  );
});

const ALLOWED = new Set(['CORRUPT_ZIP', 'UNSUPPORTED_ZIP', 'LIMIT_EXCEEDED']);
const typed = (err: unknown) => err instanceof AfterlifeError && ALLOWED.has(String(err.code));

test('P15: mutated archives give entries or a typed error, fast, with safe names', async () => {
  const base = await writeZip([
    { name: 'forms/a.xsn', bytes: new TextEncoder().encode('MSCF'.repeat(400)) },
    { name: 'records/r1.xml', bytes: new TextEncoder().encode('<a>1</a>'.repeat(200)) },
    { name: 'note.txt', bytes: new Uint8Array([1, 2, 3]) },
  ]);
  const mutation = fc.array(fc.record({ at: fc.nat(base.length - 1), value: fc.nat(255) }), {
    minLength: 1,
    maxLength: 12,
  });
  await fc.assert(
    fc.asyncProperty(mutation, fc.nat(base.length), async (edits, cut) => {
      const bytes = base.slice(0, Math.max(cut, base.length - 40));
      for (const e of edits) if (e.at < bytes.length) bytes[e.at] = e.value;
      const t0 = performance.now();
      try {
        for (const e of readZip(bytes)) {
          expect(e.name.startsWith('/')).toBe(false);
          expect(e.name.split('/')).not.toContain('..');
          await e.read().catch((err: unknown) => {
            if (!typed(err)) throw err;
          });
        }
      } catch (err) {
        if (!typed(err)) throw err;
      }
      expect(performance.now() - t0).toBeLessThan(1_000);
    }),
    { numRuns: 500 },
  );
});
