import { expect, test } from 'vitest';
import { REFUSED_ENCODINGS } from '../../src/xml/refused-encodings';
import { WHATWG_LABELS, acceptedNames, probeLabels } from '../helpers/encoding-labels';

// R5.3, D11: which WHATWG labels TextDecoder accepts in Node 22.

const probe = probeLabels(WHATWG_LABELS.map((l) => l.label));

test('the fixture has 228 labels', () => {
  expect(WHATWG_LABELS).toHaveLength(228);
});

test('the six replacement labels throw', () => {
  const replacement = WHATWG_LABELS.filter((l) => l.name === 'replacement').map((l) => l.label);
  expect(replacement).toHaveLength(6);
  for (const label of replacement) expect(probe[label], label).toBeNull();
});

test('Node accepts every other label except the refused ones', () => {
  const rejected = WHATWG_LABELS.filter((l) => l.name !== 'replacement' && probe[l.label] === null);
  for (const { label } of rejected) expect(REFUSED_ENCODINGS, label).toContain(label);
});

test('accepted canonical names, minus REFUSED_ENCODINGS, are logged', () => {
  const names = acceptedNames(probe).filter((n) => !REFUSED_ENCODINGS.includes(n));
  console.log(
    `Node ${process.version}: ${Object.values(probe).filter((v) => v !== null).length} labels ` +
      `accepted, ${names.length} canonical names outside REFUSED_ENCODINGS:\n${names.join(', ')}`,
  );
  expect(names.length).toBeGreaterThan(0);
});
