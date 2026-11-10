import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readCabinet } from '../../src/cab/reader';
import { DEFAULT_LIMITS } from '../../src/limits';
import { parseXml, xmlContext } from '../../src/xml/parse';
import { XSF_VOCABULARY } from '../../src/xsf/vocabulary';
import { walkManifest } from '../../src/xsf/walk';
import { readSample, sampleCabinets } from '../helpers/samples';

// R13.6 at the walker level, before the builders exist: walking the manifest of every
// samples/own/ form and of the public sample gives zero unknown entries.

async function manifestBytes(cab: ReturnType<typeof sampleCabinets>[number]): Promise<Uint8Array> {
  if (cab.formsDir) {
    const buf = readFileSync(`${cab.formsDir}manifest.xsf`);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const { files } = await readCabinet(readSample(cab.path));
  const manifest = files.find((f) => f.name.toLowerCase() === 'manifest.xsf');
  if (!manifest) throw new Error(`${cab.slug}: no manifest.xsf`);
  return manifest.bytes;
}

const cabinets = sampleCabinets();

test('48 manifests: 47 own forms and the public sample', () => {
  expect(cabinets).toHaveLength(48);
  expect(cabinets.filter((c) => c.formsDir)).toHaveLength(47);
});

describe.each(cabinets.map((c) => [c.slug, c] as const))('%s', (_slug, cab) => {
  test('zero unknown entries', async () => {
    const { root } = parseXml(await manifestBytes(cab), 'manifest.xsf', xmlContext(DEFAULT_LIMITS));
    const { unknowns } = walkManifest(root, 'manifest.xsf', XSF_VOCABULARY);
    expect(unknowns.map((u) => `${u.reason} ${u.path} ${u.raw.slice(0, 80)}`)).toEqual([]);
  });
});
