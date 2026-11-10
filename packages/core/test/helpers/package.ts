// Package files for parsePackage tests: the files of an in-repo cabinet, or synthetic ones.

import type { PackageFile } from '../../src/cab/reader';
import { readCabinet } from '../../src/cab/reader';
import { readSample, sampleCabinets } from './samples';

export function packageFile(name: string, bytes: Uint8Array | string): PackageFile {
  const b = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return { name, size: b.length, date: 0, time: 0, attributes: 0x20, folder: 0, bytes: b };
}

export async function sampleFiles(slug: string): Promise<PackageFile[]> {
  const cab = sampleCabinets().find((c) => c.slug === slug);
  if (!cab) throw new Error(`no sample ${slug}`);
  return [...(await readCabinet(readSample(cab.path))).files];
}

export const XSF_NS = 'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition';

/** A minimal valid package: a manifest listing `listed`, plus `extra` files. */
export function minimalPackage(
  manifestInner = '',
  options: { manifestName?: string; listed?: string[]; extra?: PackageFile[] } = {},
): PackageFile[] {
  const listed = options.listed ?? [];
  const files = listed.map((n) => `<xsf:file name="${n}"/>`).join('');
  const manifest = `<xsf:xDocumentClass solutionFormatVersion="3.0.0.0" name="urn:x" xmlns:xsf="${XSF_NS}"><xsf:package><xsf:files>${files}</xsf:files></xsf:package>${manifestInner}</xsf:xDocumentClass>`;
  return [packageFile(options.manifestName ?? 'manifest.xsf', manifest), ...(options.extra ?? [])];
}
