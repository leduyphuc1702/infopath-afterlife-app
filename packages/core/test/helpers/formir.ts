// The 48 in-repo samples parsed once per test file, for spec 02 tests.

import { parseXsn } from '../../src/index';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { formNumber } from './manifests';
import { readSample, sampleCabinets } from './samples';

export interface SampleTemplate {
  readonly slug: string;
  /** README form number; absent for the public sample. */
  readonly form?: number;
  readonly t: ParsedTemplate;
}

export async function sampleTemplates(): Promise<SampleTemplate[]> {
  const out: SampleTemplate[] = [];
  for (const c of sampleCabinets()) {
    const t = await parseXsn(readSample(c.path));
    out.push(c.formsDir ? { slug: c.slug, form: formNumber(c.slug), t } : { slug: c.slug, t });
  }
  return out;
}
