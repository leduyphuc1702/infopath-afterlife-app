import { buildFormIR, parseXsn, prepareView, renderView } from '@afterlife/core';
import { expect, test } from 'vitest';
import files from 'virtual:sample-files';
import { WorkerClient } from '../src/worker/client';
import type { ResBody, SessionRes } from '../src/worker/protocol';

// Spec 09 R3.1 (design §4): the Worker's render of a sample equals core's render on the page, for
// the same bytes and input; failures come back as AfterlifeError codes; the watchdog answers a
// silent Worker with WORKER_TIMEOUT and starts a new one with the files the old one held.

const NOW = '2026-11-10T21:24:10+07:00';
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const worker = () =>
  new Worker(new URL('../src/worker/worker.ts', import.meta.url), { type: 'module' });

test('sample 02: session, then the default view, equal to core on the page', async () => {
  const client = new WorkerClient(worker);
  const session = (await client.openSample('02-expense-report')) as SessionRes;
  expect(session.type).toBe('session');
  expect(session.templates.map((t) => t.fileName)).toEqual(['02-expense-report.xsn']);
  expect(session.records).toHaveLength(30);
  const t = session.templates[0]!;
  expect(
    session.records.every((r) => r.match.kind === 'exact' && r.match.templateId === t.templateId),
  ).toBe(true);
  const view = t.ir.views.find((v) => v.isDefault)!.name;

  const parsed = await parseXsn(b64(files['02-expense-report']!.template[1]));
  const prepared = await prepareView(parsed, buildFormIR(parsed), { view });
  for (const recordIndex of [undefined, 0] as const) {
    const rec = recordIndex === undefined ? undefined : session.records[recordIndex]!;
    const got = await client.render(t.templateId, view, rec?.recordId, NOW);
    const text = rec && files['02-expense-report']!.records.find((r) => r[0] === rec.fileName)![1];
    const want = renderView(prepared, {
      now: NOW,
      locale: 'en-US',
      ...(text !== undefined && { record: new TextEncoder().encode(text) }),
    });
    expect(got).toEqual({ type: 'rendered', ...want });
  }
  client.terminate();
});

test('a damaged template is a failure with its core code; other files still open', async () => {
  const client = new WorkerClient(worker);
  const xsn = b64(files['03-travel-request']!.template[1]);
  const bad = new File([xsn.slice(0, 200)], 'damaged.xsn');
  const good = new File([xsn], '03-travel-request.xsn');
  const s = (await client.open([bad, good])) as SessionRes;
  expect(s.templates.map((t) => t.fileName)).toEqual(['03-travel-request.xsn']);
  expect(s.failures).toHaveLength(1);
  expect(s.failures[0]!.fileName).toBe('damaged.xsn');
  expect(s.failures[0]!.error.code).toMatch(/^(CORRUPT_CAB|LIMIT_EXCEEDED|UNSUPPORTED_CAB)$/);
  client.terminate();
});

test('the watchdog answers WORKER_TIMEOUT and replays the session into a new Worker', async () => {
  const sent: string[] = [];
  let made = 0;
  const silent = () => {
    made++;
    return {
      onmessage: null,
      postMessage: (m: { type: string }) => sent.push(`${made}:${m.type}`),
      terminate: () => undefined,
    } as unknown as Worker;
  };
  const client = new WorkerClient(silent, 50);
  const r: ResBody = await client.openSample('01-leave-request');
  expect(r).toEqual({ type: 'failed', error: { code: 'WORKER_TIMEOUT', details: { ms: 50 } } });
  await new Promise((done) => setTimeout(done, 10));
  expect(made).toBe(2);
  expect(sent.slice(0, 2)).toEqual(['1:openSample', '2:openSample']);
});

// Spec 12 R4.4, R5.1: per-file progress before the answer, the session's Triage, and its CSV.
test('open: one progress message per file, in order, then the session with its Triage', async () => {
  const client = new WorkerClient(worker);
  const names = ['01-leave-request', '02-expense-report', '03-travel-request'];
  const input = names.map((n) => new File([b64(files[n]!.template[1])], `${n}.xsn`));
  const seen: string[] = [];
  const s = (await client.open(input, (p) =>
    seen.push(`${p.index}/${p.total} ${p.fileName}`),
  )) as SessionRes;
  expect(seen).toEqual([
    '1/3 01-leave-request.xsn',
    '2/3 02-expense-report.xsn',
    '3/3 03-travel-request.xsn',
  ]);
  expect(s.triage.totals.forms).toBe(3);
  const ids = new Set(s.templates.map((t) => t.templateId));
  for (const r of s.triage.rows) expect(r.kind === 'form' && ids.has(r.templateId)).toBe(true);
  // No record opened: counts are unknown, not 0 (R6.1).
  expect(s.triage.rows.map((r) => (r.kind === 'form' ? r.records : 'error'))).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
  const csv = (await client.csv()) as { type: 'csv'; text: string };
  expect(csv.type).toBe('csv');
  const lines = csv.text.trimEnd().split('\r\n');
  expect(lines).toHaveLength(4);
  expect(lines[0]).toContain('Emulated');
  client.terminate();
});

test('a sample: progress per file, records counted in its Triage row', async () => {
  const client = new WorkerClient(worker);
  let n = 0;
  const s = (await client.openSample('06-safety-incident', () => n++)) as SessionRes;
  expect(n).toBe(1 + files['06-safety-incident']!.records.length);
  const row = s.triage.rows[0]!;
  expect(row.kind === 'form' && row.records).toBe(10);
  client.terminate();
});

test("a bundled sample shows its display name in Triage; the same file opened by a user keeps core's", async () => {
  const client = new WorkerClient(worker);
  const s = (await client.openSample('theill-weight-keeper')) as SessionRes;
  const row = s.triage.rows[0]!;
  expect(row.kind === 'form' && row.name).toBe('Weight keeper');
  // The form view keeps FormIR as core built it.
  expect(s.templates[0]!.ir.meta.name).toBe('weight-keeper');
  client.terminate();
  const mine = new WorkerClient(worker);
  const file = new File(
    [b64(files['theill-weight-keeper']!.template[1])],
    'theill__weight-keeper.xsn',
  );
  const u = (await mine.open([file])) as SessionRes;
  const r = u.triage.rows[0]!;
  expect(r.kind === 'form' && r.name).toBe('weight-keeper');
  mine.terminate();
});
