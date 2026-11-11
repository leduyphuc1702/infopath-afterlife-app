import { expect, test } from 'vitest';
import { fill, recordNames, slugs } from './fill';
import { templateOf } from './fill';

// Spec 04 R11.3 (E1): for every calculated field in our records, the runtime's value from the
// record's inputs equals the stored value, compared as numbers rounded to the stored value's
// decimal places (the generator wrote `350.30`; XPath writes `350.3`). Text is compared as is.

test('calculation oracle: every stored calculated value, recomputed', async () => {
  let compared = 0;
  let records = 0;
  const mismatches: string[] = [];
  for (const slug of slugs()) {
    const { ir } = await templateOf(slug);
    const calcs = ir.calculations.filter((c) => c.targetId !== undefined);
    if (calcs.length === 0) continue;
    for (const name of recordNames(slug)) {
      records++;
      const { s } = await fill(slug, name, false);
      const stored = calcs.map((c) => s.values(c.targetId!));
      s.recalculate();
      calcs.forEach((c, i) => {
        const now = s.values(c.targetId!);
        stored[i]!.forEach((want, j) => {
          compared++;
          const got = now[j] ?? '';
          if (!same(want, got))
            mismatches.push(
              `${name} ${c.target}[${j + 1}]: stored ${want}, runtime ${got} (${c.expression})`,
            );
        });
      });
    }
  }
  console.log(
    `R11.3: ${compared - mismatches.length} of ${compared} calculated values match, over ${records} records`,
  );
  for (const m of mismatches)
    if (!m.includes(': stored , runtime')) console.log(`  mismatch: ${m}`);
  console.log(
    `  stored empty: ${mismatches.filter((m) => m.includes(': stored , runtime')).length}`,
  );
  expect(records).toBe(95);
  // Every mismatch is the sample generator's, not the runtime's (verification.md lists them):
  // (a) it left the calculated field empty (`xsi:nil="true"`) in every record of forms 10–40;
  const empty = mismatches.filter((m) => m.includes(': stored , runtime'));
  expect(new Set(empty.map((m) => m.slice(0, 2)))).toEqual(
    new Set(['10', '17', '18', '24', '29', '30', '31', '35', '40']),
  );
  // (b) in form 04 it rounded VAT with Python's round(x, 2) on a decimal subtotal, where the
  // form says XPath round(x * 100) div 100 on doubles: 62912.5 rounds up in XPath (004),
  // 151.095 is 151.09499… in binary (010), and the double sum of the line is 371.04999… (018).
  expect(mismatches.filter((m) => !empty.includes(m)).map((m) => m.split(' (')[0])).toEqual(
    ROUNDING,
  );
  expect(compared - mismatches.length).toBe(133);
});

const ROUNDING = [
  '04-purchase-request-004.xml /my:purchaseRequest/my:vatAmount[1]: stored 629.12, runtime 629.13',
  '04-purchase-request-004.xml /my:purchaseRequest/my:grandTotal[1]: stored 6920.37, runtime 6920.38',
  '04-purchase-request-010.xml /my:purchaseRequest/my:vatAmount[1]: stored 151.09, runtime 151.1',
  '04-purchase-request-010.xml /my:purchaseRequest/my:grandTotal[1]: stored 1662.04, runtime 1662.05',
  '04-purchase-request-018.xml /my:purchaseRequest/my:vatAmount[1]: stored 37.11, runtime 37.1',
  '04-purchase-request-018.xml /my:purchaseRequest/my:grandTotal[1]: stored 408.16, runtime 408.15',
];

function same(stored: string, runtime: string): boolean {
  if (stored === runtime) return true;
  if (
    !/^-?\d+(\.\d+)?$/.test(stored.trim()) ||
    runtime.trim() === '' ||
    Number.isNaN(Number(runtime))
  )
    return false;
  const places = stored.includes('.') ? stored.trim().split('.')[1]!.length : 0;
  return Number(runtime).toFixed(places) === Number(stored).toFixed(places);
}
