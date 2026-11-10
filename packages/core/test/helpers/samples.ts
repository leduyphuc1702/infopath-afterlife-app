// Lists the in-repo cabinets and reads them in place (design §13.1). Nothing is copied.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const ownXsn = `${repoRoot}samples/own/xsn/`;
const ownForms = `${repoRoot}samples/own/forms/`;
const publicDir = `${repoRoot}samples/public/theill-weight-keeper/`;

export interface SampleCabinet {
  /** `01-leave-request`, or `theill-weight-keeper` for the public sample. */
  slug: string;
  /** Absolute path of the `.xsn`. */
  path: string;
  /** Absolute path of `samples/own/forms/<slug>/`; absent for the public sample. */
  formsDir?: string;
}

/** Every `samples/own/xsn/*.xsn` (sorted by name), then the public sample. */
export function sampleCabinets(): SampleCabinet[] {
  const own = readdirSync(ownXsn)
    .filter((name) => name.endsWith('.xsn'))
    .sort()
    .map((name): SampleCabinet => {
      const slug = name.slice(0, -'.xsn'.length);
      const formsDir = `${ownForms}${slug}/`;
      return existsSync(formsDir)
        ? { slug, path: `${ownXsn}${name}`, formsDir }
        : { slug, path: `${ownXsn}${name}` };
    });
  return [...own, { slug: 'theill-weight-keeper', path: `${publicDir}theill__weight-keeper.xsn` }];
}

export function readSample(path: string): Uint8Array {
  const buf = readFileSync(path);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
