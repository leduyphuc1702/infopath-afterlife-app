import { DOMParser } from '@xmldom/xmldom';
import fc from 'fast-check';
import { expect, test } from 'vitest';
import * as xpath from 'xpath';
import { exportRecords, readZip, type FormIR, type RecordFile } from '../../src/index';
import { irOf, recordsOf, slugsWithRecords } from '../legacy/records';

// Property P11 (testing.md; spec 09 R12.7): for any of our own forms with records, and any subset
// of its records in any order, parsing the exported CSVs gives back every non-repeating field
// value of every record, and each repeating sheet has as many rows per record as the record has
// items. The oracle reads the records with xmldom and XPath, not with core's tables.

/** RFC 4180, undoing core's formula guard (a leading `'` before `= + - @ tab CR`). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const push = () => {
    row.push(/^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell);
    cell = '';
  };
  for (; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') push();
    else if (ch === '\r' && text[i + 1] === '\n') {
      push();
      rows.push(row);
      row = [];
      i++;
    } else cell += ch;
  }
  return rows;
}

const slugs = slugsWithRecords();
const forms = new Map<string, { ir: FormIR; records: RecordFile[] }>();
for (const s of slugs) forms.set(s, { ir: await irOf(s), records: recordsOf(s) });

const NUMERIC = /^xsd:(decimal|double|float|.*[iI]nteger|int|long|short|byte|unsigned\w+)$/;

function expected(ir: FormIR, path: string, doc: Document, select: xpath.XPathSelect): string {
  const f = ir.fields.find((x) => x.path === path)!;
  const node = (select(path, doc) as Node[])[0];
  if (!node) return '';
  const el = node as Element;
  if (el.getAttributeNS?.('http://www.w3.org/2001/XMLSchema-instance', 'nil') === 'true') return '';
  const text = node.textContent ?? '';
  const t = text.trim();
  if (f.kind === 'richText') return text.replace(/\s+/g, '');
  if (f.xsdType.builtin === 'xsd:base64Binary') return t === '' ? '' : 'a file';
  if (f.xsdType.builtin === 'xsd:boolean')
    return t === 'true' || t === '1' ? 'TRUE' : t === 'false' || t === '0' ? 'FALSE' : t;
  if (NUMERIC.test(f.xsdType.builtin ?? '') && /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(t))
    return t;
  return text;
}

let compared = 0;
let counted = 0;

test('P11: CSV export round trip over our own records', async () => {
  expect(slugs.length).toBeGreaterThanOrEqual(8);
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...slugs).chain((slug) =>
        fc.tuple(
          fc.constant(slug),
          fc.shuffledSubarray(forms.get(slug)!.records, {
            minLength: 1,
            maxLength: Math.min(12, forms.get(slug)!.records.length),
          }),
        ),
      ),
      async ([slug, records]) => {
        const { ir } = forms.get(slug)!;
        const out = await exportRecords(ir, records, { format: 'csv' });
        const csv = new Map<string, string[][]>();
        for (const e of readZip(out.bytes))
          if (e.name.endsWith('.csv'))
            csv.set(e.name, parseCsv(new TextDecoder().decode(await e.read())));
        const [head, ...rows] = csv.get('Records.csv')!;
        expect(rows.map((r) => r[0])).toEqual(records.map((r) => r.fileName));
        for (const [n, record] of records.entries()) {
          const doc = new DOMParser().parseFromString(
            new TextDecoder().decode(record.bytes),
            'text/xml',
          );
          const ns: Record<string, string> = {};
          for (const a of [...doc.documentElement!.attributes])
            if (a.name.startsWith('xmlns:')) ns[a.name.slice(6)] = a.value;
          const select = xpath.useNamespaces(ns);
          for (const [i, path] of head!.entries()) {
            if (i < 2) continue;
            const got = rows[n]![i]!;
            const want = expected(ir, path, doc as unknown as Document, select);
            const f = ir.fields.find((x) => x.path === path)!;
            if (f.kind === 'richText') expect(got.replace(/\s+/g, ''), path).toBe(want);
            else if (want === 'a file') expect(got, path).toMatch(/^attachments\//);
            else expect(got, `${record.fileName} ${path}`).toBe(want);
            compared++;
          }
          // Each repeating sheet: as many rows for this record as the record has items.
          for (const [name, [h, ...items]] of csv) {
            if (name === 'Records.csv') continue;
            const g = h![h![2] === 'Parent row' ? 3 : 2]!;
            const groupPath = g.slice(0, g.lastIndexOf('/'));
            const group =
              ir.groups.find((x) => x.repeating && x.path === groupPath) ??
              ir.fields.find((x) => x.repeating && x.path === g)!;
            const count = (select(group.path, doc as unknown as Document) as Node[]).length;
            expect(
              items.filter((r) => r[0] === record.fileName),
              `${name} ${record.fileName}`,
            ).toHaveLength(count);
            counted += count;
          }
        }
      },
    ),
    { numRuns: 100 },
  );
  console.log(
    `P11: ${slugs.length} forms, ${compared} values and ${counted} repeating rows compared`,
  );
  expect(compared).toBeGreaterThan(1_500);
  expect(counted).toBeGreaterThan(50);
});
