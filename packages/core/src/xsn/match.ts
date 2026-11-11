// Spec 09 R2, R11 (P14): which open template made a record. A record names its template in the
// `<?mso-infoPathSolution name="urn…" solutionVersion="…"?>` processing instruction, read from
// the first 4 KB without a DOM (spec 01 D8), as spec 03's RECORD_TEMPLATE_MISMATCH reads it.
import { solutionAttribute } from './package';

/** A template's identity: FormIR `meta.urn` and `meta.solutionVersion`. */
export interface TemplateKey {
  readonly urn?: string;
  readonly version?: string;
  /** Spec 24 W3: `xDocumentClass/@publishUrl`, for records whose instruction has no `name`. */
  readonly publishUrl?: string;
}

/** `file:///C:/Forms/a%20b.xsn` and `c:\forms\a b.xsn` are the same place. */
const place = (url: string) => {
  let u = url.trim().replace(/\\/g, '/');
  try {
    u = decodeURIComponent(u);
  } catch {
    // kept as written
  }
  return u.replace(/^file:\/*/i, '').toLowerCase();
};

/**
 * Spec 24 W3: the record as Download XML writes it. A template without a form ID gives its new
 * records `href="manifest.xsf"`; the template's `publishUrl` goes there instead, so the record can
 * be matched to it again, as InfoPath's saved records were.
 */
export function downloadedXml(xml: string, publishUrl: string | undefined): string {
  if (publishUrl === undefined || publishUrl.trim() === '') return xml;
  return xml.replace(/<\?mso-infoPathSolution\b([\s\S]*?)\?>/, (pi, attrs: string) => {
    if (/(?:^|\s)name\s*=/.test(attrs) || !/(?:^|\s)href\s*=\s*["']manifest\.xsf["']/i.test(attrs))
      return pi;
    const esc = publishUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return pi.replace(/(\shref\s*=\s*)(["'])manifest\.xsf\2/i, `$1"${esc}"`);
  });
}

export type RecordMatch =
  | { readonly kind: 'exact'; readonly template: number }
  | { readonly kind: 'otherVersion'; readonly template: number; readonly recordVersion: string }
  | {
      readonly kind: 'unmatched';
      readonly reason: 'noSolution' | 'noTemplate';
      readonly urn?: string;
    };

/**
 * Dotted version order: numeric parts compare as numbers, others as strings, then the shorter
 * version first; equal versions written differently (`1.0`, `1.00`) fall back to the text, so the
 * order is total and the result does not depend on the order of `templates`.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i]!;
    const y = pb[i]!;
    const d = /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) - Number(y) : cmp(x, y);
    if (d !== 0) return Math.sign(d);
  }
  return pa.length - pb.length || cmp(a, b);
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Absent versions sort lowest. */
const byVersion = (a: string | undefined, b: string | undefined) =>
  a === undefined ? (b === undefined ? 0 : -1) : b === undefined ? 1 : compareVersions(a, b);

/** The index of the highest version among `indices`; ties go to the lowest index. */
function highest(indices: readonly number[], templates: readonly TemplateKey[]): number {
  return indices.reduce((best, i) =>
    byVersion(templates[i]!.version, templates[best]!.version) > 0 ? i : best,
  );
}

/**
 * Matches one record against the open templates. Same URN and version first; a version missing
 * on either side counts as equal, as in render's mismatch check. Otherwise the same URN with the
 * highest version not above the record's, else the lowest above it.
 */
export function matchRecord(record: Uint8Array, templates: readonly TemplateKey[]): RecordMatch {
  const urn = solutionAttribute(record, 'name');
  if (urn === undefined) {
    // Spec 24 W3: no form ID on either side: the place the template was published to.
    const href = solutionAttribute(record, 'href');
    const at =
      href === undefined
        ? -1
        : templates.findIndex(
            (t) =>
              t.urn === undefined &&
              t.publishUrl !== undefined &&
              place(t.publishUrl) === place(href),
          );
    return at >= 0 ? { kind: 'exact', template: at } : { kind: 'unmatched', reason: 'noSolution' };
  }
  const version = solutionAttribute(record, 'solutionVersion');
  const same = templates.flatMap((t, i) => (t.urn === urn ? [i] : []));
  if (same.length === 0) return { kind: 'unmatched', reason: 'noTemplate', urn };

  const equal = same.filter((i) => templates[i]!.version === version);
  if (equal.length > 0) return { kind: 'exact', template: equal[0]! };
  const unversioned = same.filter(
    (i) => version === undefined || templates[i]!.version === undefined,
  );
  if (unversioned.length > 0) return { kind: 'exact', template: highest(unversioned, templates) };

  const recordVersion = version!;
  const below = same.filter((i) => compareVersions(templates[i]!.version!, recordVersion) <= 0);
  if (below.length > 0)
    return { kind: 'otherVersion', template: highest(below, templates), recordVersion };
  const lowest = same.reduce((best, i) =>
    compareVersions(templates[i]!.version!, templates[best]!.version!) < 0 ? i : best,
  );
  return { kind: 'otherVersion', template: lowest, recordVersion };
}
