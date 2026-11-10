// Inputs for schema-set and field-tree tests: the `.xsd` files of a folder (recursively, named by
// their last path segment, as in a cabinet), and a manifest that names the schema roots.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { DEFAULT_LIMITS } from '../../src/limits';
import { xmlContext } from '../../src/xml/parse';
import { loadSchemaSet, type SchemaFileInput, type SchemaSet } from '../../src/xsd/schema-set';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { readCabinet } from '../../src/cab/reader';
import { sampleCabinets, readSample } from './samples';
import { manifestBytes } from './synthetic-manifest';

export function xsdFiles(dir: string): SchemaFileInput[] {
  const out: SchemaFileInput[] = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) out.push(...xsdFiles(path));
    else if (/\.xsd$/i.test(name)) out.push({ name, bytes: new Uint8Array(readFileSync(path)) });
  }
  return out;
}

export const syntheticXsd = (sub = '') =>
  new URL(`../fixtures/synthetic/xsd/${sub}`, import.meta.url).pathname.replace(/\/$/, '');

/**
 * A schema set for synthetic files: `main` is the rootSchema file (optional `rootElement`),
 * `secondary` maps data object names to schema files.
 */
export function syntheticSet(
  files: readonly SchemaFileInput[],
  main?: { file: string; rootElement?: string },
  secondary: Readonly<Record<string, string>> = {},
): SchemaSet {
  const pkg = main?.rootElement
    ? `<xsf:package><xsf:files><xsf:file name="${main.file}"><xsf:fileProperties><xsf:property name="rootElement" type="string" value="${main.rootElement}"/></xsf:fileProperties></xsf:file></xsf:files></xsf:package>`
    : '';
  const schemas = main
    ? `<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:x ${main.file}"/></xsf:documentSchemas>`
    : '';
  const objects = Object.keys(secondary).length
    ? `<xsf:dataObjects>${Object.entries(secondary)
        .map(([n, s]) => `<xsf:dataObject name="${n}" schema="${s}"/>`)
        .join('')}</xsf:dataObjects>`
    : '';
  const { manifest } = parseManifest(manifestBytes(pkg + schemas + objects));
  return loadSchemaSet(files, manifest, xmlContext(DEFAULT_LIMITS));
}

/** The schema set of every in-repo sample, keyed by slug. */
export async function sampleSchemaSets(): Promise<Map<string, SchemaSet>> {
  const out = new Map<string, SchemaSet>();
  for (const cab of sampleCabinets()) {
    const { files } = await readCabinet(readSample(cab.path));
    const manifestFile = files.find((f) => f.name.toLowerCase() === 'manifest.xsf')!;
    const { manifest } = parseManifest(manifestFile.bytes);
    out.set(cab.slug, loadSchemaSet(files, manifest, xmlContext(DEFAULT_LIMITS)));
  }
  return out;
}
