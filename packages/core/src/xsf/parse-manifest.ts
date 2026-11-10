// Internal: manifest bytes → typed Manifest and unknown entries (design §7.2, §8). Joins xml/, the
// walker and the builders. Every problem here is fatal for the template (R5.4).

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
  readonly unknowns: readonly UnknownEntry[];
  /** Non-fatal XML findings (`INVALID_ENCODING`, `XML_WARNING`). */
  readonly issues: readonly Issue[];
}

export function parseManifest(
  bytes: Uint8Array,
  file = 'manifest.xsf',
  ctx: XmlContext = xmlContext(DEFAULT_LIMITS),
): ParsedManifest {
  const { root, issues } = parseXml(bytes, file, ctx);
  const { root: model, unknowns } = walkManifest(root, file, XSF_VOCABULARY);
  return { manifest: buildManifest(model), unknowns, issues };
}
