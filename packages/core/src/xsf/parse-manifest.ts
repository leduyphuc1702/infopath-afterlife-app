// Internal: manifest bytes → typed Manifest and unknown entries (design §7.2, §8). Joins xml/, the
// walker and the builders. XML that cannot be read is fatal for the template (R5.4); a repeated
// held-once element is not (R13.9).

import type { Issue } from '../errors';
import { DEFAULT_LIMITS } from '../limits';
import type { UnknownEntry } from '../unknown';
import { parseXml, xmlContext, type XmlContext } from '../xml/parse';
import { buildManifest } from './build';
import type { Manifest } from './types';
import { XSF_VOCABULARY } from './vocabulary';
import { walkManifest } from './walk';

export interface ParsedManifest {
  readonly manifest: Manifest;
  /** Walker entries and `repeated` entries, in document order (R13.7). */
  readonly unknowns: readonly UnknownEntry[];
  /** `INVALID_ENCODING`, `XML_WARNING` and `REPEATED_ELEMENT`. */
  readonly issues: readonly Issue[];
}

export function parseManifest(
  bytes: Uint8Array,
  file = 'manifest.xsf',
  ctx: XmlContext = xmlContext(DEFAULT_LIMITS),
): ParsedManifest {
  const { root, issues } = parseXml(bytes, file, ctx);
  const walked = walkManifest(root, file, XSF_VOCABULARY);
  const built = buildManifest(walked.root);
  // A walker entry inside a repeated subtree is part of that subtree's one entry (R13.1).
  const inside = (path: string) =>
    built.repeatedPaths.some((p) => path === p || path.startsWith(`${p}/`));
  const unknowns = [...walked.unknowns.filter((u) => !inside(u.path)), ...built.unknowns].sort(
    (a, b) => a.line - b.line || a.column - b.column,
  );
  return { manifest: built.manifest, unknowns, issues: [...issues, ...built.issues] };
}
