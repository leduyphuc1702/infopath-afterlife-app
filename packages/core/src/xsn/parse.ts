// parsePackage and parseXsn (design §1, §4, §10). Only the cabinet and the manifest can be fatal
// (R5.4); every other problem is an issue in the result.

import { readCabinet, type CabinetInfo, type PackageFile } from '../cab/reader';
import type { Issue } from '../errors';
import { resolveLimits, type ParseOptions } from '../limits';
import type { UnknownEntry } from '../unknown';
import { xmlContext } from '../xml/parse';
import { buildFieldTree } from '../xsd/field-tree';
import { loadSchemaSet } from '../xsd/schema-set';
import type { FieldTree } from '../xsd/types';
import { parseManifest } from '../xsf/parse-manifest';
import type { Manifest } from '../xsf/types';
import { checkPackage, findManifest } from './package';

export interface ParsedTemplate {
  readonly parserVersion: 1;
  /** Present when the template came from a cabinet (`parseXsn`); absent from `parsePackage`. */
  readonly cabinet?: CabinetInfo;
  /** CFFILE order (R1.5). */
  readonly files: readonly PackageFile[];
  /** The package file used as the manifest (R6.1). */
  readonly manifestFile: string;
  readonly manifest: Manifest;
  readonly schemas: {
    /** Absent only when the main schema is missing or failed (an issue says why). */
    readonly main?: FieldTree;
    /** Key: `dataObject/@name` (R11.6). */
    readonly secondary: Readonly<Record<string, FieldTree>>;
  };
  /** Package files named `*.dll`, `*.pdb`, `*.js` or `*.vbs`, any case, CFFILE order (R12.4). */
  readonly codeFiles: readonly string[];
  /** Manifest first, then schema files by name; document order within a file. */
  readonly unknowns: readonly UnknownEntry[];
  /**
   * Cabinet issues, then the manifest's XML and REPEATED_ELEMENT issues, then package checks,
   * then schema loading, then field trees.
   */
  readonly issues: readonly Issue[];
}

const CODE = /\.(dll|pdb|js|vbs)$/i;

export function parsePackage(
  files: readonly PackageFile[],
  options?: ParseOptions,
): ParsedTemplate {
  return build(files, [], undefined, options);
}

export async function parseXsn(bytes: Uint8Array, options?: ParseOptions): Promise<ParsedTemplate> {
  const cabinet = await readCabinet(bytes, options);
  return build(cabinet.files, cabinet.issues, cabinet.info, options);
}

function build(
  files: readonly PackageFile[],
  cabinetIssues: readonly Issue[],
  cabinet: CabinetInfo | undefined,
  options: ParseOptions | undefined,
): ParsedTemplate {
  const ctx = xmlContext(resolveLimits(options?.limits));
  const manifestFile = findManifest(files);
  const parsed = parseManifest(manifestFile.bytes, manifestFile.name, ctx);
  const issues: Issue[] = [
    ...cabinetIssues,
    ...parsed.issues,
    ...checkPackage(files, manifestFile, parsed.manifest),
  ];

  const set = loadSchemaSet(files, parsed.manifest, ctx);
  issues.push(...set.issues);
  const main = set.main && buildFieldTree(set.main, issues);
  const secondary: Record<string, FieldTree> = {};
  for (const [name, root] of Object.entries(set.secondary)) {
    const t = buildFieldTree(root, issues);
    if (t) secondary[name] = t;
  }

  return {
    parserVersion: 1,
    ...(cabinet ? { cabinet } : {}),
    files,
    manifestFile: manifestFile.name,
    manifest: parsed.manifest,
    schemas: { ...(main ? { main } : {}), secondary },
    codeFiles: files.filter((f) => CODE.test(f.name)).map((f) => f.name),
    unknowns: [...parsed.unknowns, ...set.unknowns],
    issues,
  };
}
