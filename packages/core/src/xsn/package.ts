// Package-level checks (design §10, R6): which file is the manifest, which files the manifest
// refers to, and whether the package and the manifest agree. Everything except a missing manifest
// is an issue; the bytes are always kept.

import type { PackageFile } from '../cab/reader';
import { AfterlifeError, type Issue } from '../errors';
import { classifyLocation } from '../xsd/schema-set';
import type { Manifest, Modelled, SpecKey } from '../xsf/types';

/** R6.1: `manifest.xsf` (any case), else the only `.xsf`; otherwise MISSING_MANIFEST. */
export function findManifest(files: readonly PackageFile[]): PackageFile {
  const named = files.find((f) => f.name.toLowerCase() === 'manifest.xsf');
  if (named) return named;
  const xsf = files.filter((f) => /\.xsf$/i.test(f.name));
  if (xsf.length === 1) return xsf[0]!;
  throw new AfterlifeError('MISSING_MANIFEST', { names: files.map((f) => f.name).join(',') });
}

export interface FileReference {
  /** The package file name the manifest refers to. */
  readonly name: string;
  /** The attribute holding it, e.g. `…/xsf:mainpane[1]/@transform`. */
  readonly path: string;
  readonly line: number;
  readonly column: number;
  /** Which R6.2 reference kind. */
  readonly kind: string;
}

/** Every package file the manifest refers to (R6.2), in document order. */
export function fileReferences(manifest: Manifest): FileReference[] {
  const refs: FileReference[] = [];
  const add = <K extends SpecKey>(
    m: Modelled<K> | undefined,
    attr: string,
    kind: string,
    value = m && (m.attrs as Record<string, string | undefined>)[attr],
  ) => {
    if (!m || value === undefined || value.trim() === '') return;
    refs.push({
      name: value.trim(),
      path: `${m.path}/@${attr}`,
      line: m.line,
      column: m.column,
      kind,
    });
  };

  for (const f of manifest.package) add(f, 'name', 'file');
  for (const v of manifest.views) for (const p of v.mainpanes) add(p, 'transform', 'mainpane');
  add(manifest.upgrade, 'transform', 'useTransform');
  add(manifest.fileNew, 'href', 'initialXmlDocument');
  for (const s of manifest.documentSchemas) {
    // `location` is "namespace file" or just "file": the last token is the file.
    add(s, 'location', 'documentSchema', s.attrs.location?.trim().split(/\s+/).pop());
  }
  for (const d of manifest.dataObjects) add(d, 'schema', 'dataObject');

  const adapters = [
    ...(manifest.mainQuery ? [manifest.mainQuery] : []),
    ...manifest.dataObjects.flatMap((d) => (d.query ? [d.query] : [])),
    ...(manifest.submit?.adapters ?? []),
    ...manifest.dataAdapters,
  ];
  for (const a of adapters) {
    if (a.key === 'xsf:xmlFileAdapter') {
      const url = a.attrs.fileUrl;
      const where = url === undefined ? undefined : classifyLocation(url);
      if (where?.kind === 'file') add(a, 'fileUrl', 'xmlFileAdapter', where.name);
    }
    for (const c of a.children) if (c.key === 'xsf:input') add(c, 'source', 'input');
  }
  for (const s of manifest.scripts?.scripts ?? []) add(s, 'src', 'script');
  // R21.2: import sources and a relative task pane.
  for (const i of manifest.importSources) {
    add(i, 'transform', 'importSource');
    add(i, 'schema', 'importSource');
  }
  const pane = manifest.taskpane?.attrs.href;
  const paneAt = pane === undefined ? undefined : classifyLocation(pane);
  if (paneAt?.kind === 'file') add(manifest.taskpane, 'href', 'taskpane', paneAt.name);

  return refs.sort((x, y) => x.line - y.line || x.column - y.column);
}

/** R6.2–R6.6. `manifestFile` is exempt from UNLISTED_FILE. */
export function checkPackage(
  files: readonly PackageFile[],
  manifestFile: PackageFile,
  manifest: Manifest,
): Issue[] {
  const issues: Issue[] = [];
  const present = new Set(files.map((f) => f.name.toLowerCase()));

  // R6.5: names.
  const seen = new Map<string, string>();
  for (const f of files) {
    const lower = f.name.toLowerCase();
    const first = seen.get(lower);
    if (first !== undefined) {
      issues.push({
        code: 'DUPLICATE_NAME',
        message: `${f.name}: another package file is named ${first} (names compare ignoring case)`,
        file: f.name,
        details: { name: f.name, other: first },
      });
    } else seen.set(lower, f.name);
    const reason = unsafe(f.name);
    if (reason) {
      issues.push({
        code: 'UNSAFE_NAME',
        message: `${f.name}: unsafe package file name (${reason}); the bytes are kept`,
        file: f.name,
        details: { name: f.name, reason },
      });
    }
  }

  // R6.2–R6.3: references.
  for (const r of fileReferences(manifest)) {
    if (present.has(r.name.toLowerCase())) continue;
    issues.push({
      code: 'MISSING_FILE',
      message: `${manifestFile.name}: ${r.kind} refers to ${r.name}, which is not in the package`,
      file: manifestFile.name,
      path: r.path,
      line: r.line,
      column: r.column,
      details: { name: r.name, kind: r.kind },
    });
  }

  // R6.4: files not listed in xsf:files.
  const listed = new Set(
    manifest.package.flatMap((p) =>
      p.attrs.name === undefined ? [] : [p.attrs.name.toLowerCase()],
    ),
  );
  for (const f of files) {
    if (f === manifestFile || listed.has(f.name.toLowerCase())) continue;
    issues.push({
      code: 'UNLISTED_FILE',
      message: `${f.name}: not listed in xsf:package/xsf:files`,
      file: f.name,
      details: { name: f.name },
    });
  }

  // R6.6: template.xml's mso-infoPathSolution name (D8: first 4 KB only, no DOM).
  const template = files.find((f) => f.name.toLowerCase() === 'template.xml');
  const urn = manifest.documentClass.attrs.name;
  const piName = template && solutionName(template.bytes);
  if (template && piName !== undefined && urn !== undefined && piName !== urn) {
    issues.push({
      code: 'URN_MISMATCH',
      message: `${template.name}: mso-infoPathSolution name ${piName} differs from xDocumentClass/@name ${urn}`,
      file: template.name,
      details: { template: piName, manifest: urn },
    });
  }
  return issues;
}

/** Why a name is unsafe to write to disk: a `..` segment, a drive letter, or a leading separator. */
export function unsafe(name: string): string | undefined {
  if (/^[\\/]/.test(name)) return 'leadingSeparator';
  if (/^[a-z]:/i.test(name)) return 'driveLetter';
  if (name.split(/[\\/]/).includes('..')) return 'parentSegment';
  return undefined;
}

/** `name` of the `<?mso-infoPathSolution …?>` PI in the first 4 KB, if any (D8). */
export function solutionName(bytes: Uint8Array): string | undefined {
  return solutionAttribute(bytes, 'name');
}

/**
 * An attribute of the `<?mso-infoPathSolution …?>` PI in the first 4 KB, if any (D8). Spec 03
 * R2.1 reads `name` and `solutionVersion` of a record with it.
 */
export function solutionAttribute(bytes: Uint8Array, attribute: string): string | undefined {
  const text = headText(bytes);
  const pi = /<\?mso-infoPathSolution\b([\s\S]*?)\?>/.exec(text);
  if (!pi) return undefined;
  const value = new RegExp(`(?:^|\\s)${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`).exec(pi[1]!);
  return value?.[2];
}

/** The first 4 KB as text, by BOM or the first bytes (D8; spec 12 reads `xml-stylesheet` with it). */
export function headText(bytes: Uint8Array): string {
  const head = bytes.subarray(0, 4096);
  const b = (i: number) => head[i] ?? -1;
  const label =
    (b(0) === 0xff && b(1) === 0xfe) || (b(0) === 0x3c && b(1) === 0 && b(2) === 0x3f)
      ? 'utf-16le'
      : (b(0) === 0xfe && b(1) === 0xff) || (b(0) === 0 && b(1) === 0x3c && b(2) === 0)
        ? 'utf-16be'
        : 'utf-8';
  return new TextDecoder(label).decode(head);
}
