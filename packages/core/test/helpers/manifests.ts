// The manifest bytes of every in-repo sample: samples/own/forms/<slug>/manifest.xsf read in place,
// and the public sample's manifest read from its cabinet (it has no unpacked copy).

import { readFileSync } from 'node:fs';
import { readCabinet } from '../../src/cab/reader';
import { readSample, sampleCabinets } from './samples';

export interface SampleManifest {
  readonly slug: string;
  /** `samples/own/` (true) or the public sample (false). */
  readonly own: boolean;
  readonly bytes: Uint8Array;
}

export async function sampleManifests(): Promise<SampleManifest[]> {
  const out: SampleManifest[] = [];
  for (const cab of sampleCabinets()) {
    if (cab.formsDir) {
      const buf = readFileSync(`${cab.formsDir}manifest.xsf`);
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      out.push({ slug: cab.slug, own: true, bytes });
      continue;
    }
    const { files } = await readCabinet(readSample(cab.path));
    const manifest = files.find((f) => f.name.toLowerCase() === 'manifest.xsf');
    if (!manifest) throw new Error(`${cab.slug}: no manifest.xsf`);
    out.push({ slug: cab.slug, own: false, bytes: manifest.bytes });
  }
  return out;
}

/** The two-digit form number of an own sample slug (`05-new-hire-onboarding` → 5). */
export function formNumber(slug: string): number {
  return Number(slug.slice(0, 2));
}
