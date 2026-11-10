import { commands } from 'vitest/browser';
import { expect, test } from 'vitest';
import { REFUSED_ENCODINGS } from '../../src/xml/refused-encodings';
import { WHATWG_LABELS, acceptedNames } from '../helpers/encoding-labels';
import { runWorker } from './run-worker';

// R5.3, D11: TextDecoder label support in a dedicated Worker against Node 22. REFUSED_ENCODINGS
// must be exactly the canonical names that only one of the two accepts.

const labels = WHATWG_LABELS.map((l) => l.label);
const worker = await runWorker<Record<string, string | null>>(
  new URL('./encodings.worker.ts', import.meta.url),
  labels,
);
const node = await commands.nodeAcceptedLabels();
const notRefused = (name: string) => !REFUSED_ENCODINGS.includes(name);

test('the six replacement labels throw in the Worker', () => {
  const replacement = WHATWG_LABELS.filter((l) => l.name === 'replacement');
  expect(replacement).toHaveLength(6);
  for (const { label } of replacement) expect(worker[label], label).toBeNull();
});

test('accepted canonical names, minus REFUSED_ENCODINGS, equal Node', () => {
  console.log(
    `${navigator.userAgent}: ${Object.values(worker).filter((v) => v !== null).length} labels ` +
      `accepted; Node: ${Object.values(node).filter((v) => v !== null).length}`,
  );
  expect(acceptedNames(worker).filter(notRefused)).toEqual(acceptedNames(node).filter(notRefused));
});

test('every label outside REFUSED_ENCODINGS maps to the same name in both', () => {
  for (const label of labels) {
    const name = worker[label] ?? node[label];
    if (name != null && !notRefused(name)) continue;
    expect(worker[label], label).toBe(node[label]);
  }
});

test('every name in REFUSED_ENCODINGS is accepted by exactly one runtime', () => {
  const inWorker = new Set(acceptedNames(worker));
  const inNode = new Set(acceptedNames(node));
  for (const name of REFUSED_ENCODINGS) {
    expect(inWorker.has(name) !== inNode.has(name), name).toBe(true);
  }
});
