// FormIR of the 48 in-repo samples, built once per test file (spec 12 tests).
import { buildFormIR, parseXsn, type FormIR } from '../../src/index';
import { readSample, sampleCabinets } from './samples';

export interface SampleIR {
  readonly slug: string;
  readonly fileName: string;
  readonly ir: FormIR;
}

export async function sampleIRs(): Promise<SampleIR[]> {
  const out: SampleIR[] = [];
  for (const c of sampleCabinets())
    out.push({
      slug: c.slug,
      fileName: c.path.slice(c.path.lastIndexOf('/') + 1),
      ir: buildFormIR(await parseXsn(readSample(c.path))),
    });
  return out;
}
