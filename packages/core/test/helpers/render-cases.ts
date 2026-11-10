// The 53 views of spec 03 (forms 01–47 and the public sample), each with its empty record and its
// first record (requirements glossary). Records are read in place from samples/own/records/; the
// public sample's come from its own package (template.xml, sampledata.xml).

import { readFileSync } from 'node:fs';
import { parseXsn } from '../../src/index';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { readSample, repoRoot, sampleCabinets } from './samples';

export interface ViewCase {
  /** `01-leave-request/view1.xsl`. */
  readonly id: string;
  readonly slug: string;
  /** One of our forms (samples/own/), not the public sample. */
  readonly own: boolean;
  readonly t: ParsedTemplate;
  /** `xsf:view/@name`. */
  readonly view: string;
  /** `mainpane/@transform`. */
  readonly xslFile: string;
  readonly records: { readonly empty: Uint8Array; readonly first: Uint8Array };
}

/** A package file by name, ignoring case (spec 01 R6.2). */
export function packageFileOf(t: ParsedTemplate): (name: string) => Uint8Array | undefined {
  const byName = new Map(t.files.map((f) => [f.name.toLowerCase(), f.bytes]));
  return (name) => byName.get(name.toLowerCase());
}

const records = `${repoRoot}samples/own/records/`;
const read = (path: string) => new Uint8Array(readFileSync(path));

export async function viewCases(): Promise<ViewCase[]> {
  const out: ViewCase[] = [];
  for (const c of sampleCabinets()) {
    const t = await parseXsn(readSample(c.path));
    const file = packageFileOf(t);
    const own = c.formsDir !== undefined;
    const recs = own
      ? {
          empty: read(`${records}${c.slug}/${c.slug}-000-empty.xml`),
          first: read(`${records}${c.slug}/${c.slug}-001.xml`),
        }
      : { empty: file('template.xml')!, first: file('sampledata.xml')! };
    for (const v of t.manifest.views) {
      const xslFile = v.mainpanes[0]?.attrs.transform;
      if (xslFile === undefined) continue;
      out.push({
        id: `${c.slug}/${xslFile}`,
        slug: c.slug,
        own,
        t,
        view: v.attrs.name ?? xslFile,
        xslFile,
        records: recs,
      });
    }
  }
  return out;
}
