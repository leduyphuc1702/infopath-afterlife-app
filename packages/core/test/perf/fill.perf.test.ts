import { expect, test } from 'vitest';
import { prepareView, renderView } from '../../src/index';
import { fill, NOW } from '../runtime/fill';

// Spec 04 R2.4 (E2): one change cycle, command in to render out: edit, the cycle, serialise,
// renderView of the default view. 3 warm-up cycles, then 50 timed; p95 nearest-rank. Form 04 has
// the longest calculation chain; form 08 has 200 fields and no rules, so it is render-bound.

const RUNS = 50;
const positional = (path: string) => path.replace(/(?<=[^/])(?=\/|$)/g, '[1]');

async function measure(
  slug: string,
  record: string,
  path: (ir: Awaited<ReturnType<typeof fill>>['ir']) => string,
) {
  const { s, t, ir } = await fill(slug, record);
  const prepared = await prepareView(t, ir);
  const at = path(ir);
  const times: number[] = [];
  for (let i = 0; i < RUNS + 3; i++) {
    const t0 = performance.now();
    s.edit(at, String(10 + (i % 7)), NOW);
    renderView(prepared, { record: new TextEncoder().encode(s.xml()), now: NOW });
    if (i >= 3) times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return { p50: times[Math.ceil(0.5 * RUNS) - 1]!, p95: times[Math.ceil(0.95 * RUNS) - 1]! };
}

test('R2.4: form 04 cycle p95 under 30 ms; form 08 reported', async () => {
  const f04 = await measure(
    '04-purchase-request',
    '04-purchase-request-001.xml',
    () => '/my:purchaseRequest[1]/my:lines[1]/my:line[1]/my:unitPrice[1]',
  );
  const f08 = await measure('08-big-form', '08-big-form-001.xml', (ir) =>
    positional(
      ir.fields.find((f) => f.xsdType?.builtin === 'xsd:string' && f.kind === 'field')!.path,
    ),
  );
  console.log(
    `R2.4 (Node ${process.version}): form 04 p50 ${f04.p50.toFixed(2)} ms, p95 ${f04.p95.toFixed(2)} ms; form 08 p50 ${f08.p50.toFixed(2)} ms, p95 ${f08.p95.toFixed(2)} ms`,
  );
  expect(f04.p95).toBeLessThan(30);
  expect(f08.p95).toBeLessThan(30);
}, 60_000);
