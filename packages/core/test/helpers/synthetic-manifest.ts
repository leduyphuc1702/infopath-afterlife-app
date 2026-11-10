// Synthetic manifests for builder tests: a minimal xDocumentClass wrapped around a fragment.

import { encode } from './encode';

export const XSF = 'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition';
export const XSF2 =
  'http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions';
export const XSF3 =
  'http://schemas.microsoft.com/office/infopath/2009/solutionDefinition/extensions';

/** A manifest whose root holds `inner`; xsf, xsf2, xsf3, xd and my are declared on the root. */
export function manifestXml(inner: string, rootAttrs = 'solutionFormatVersion="3.0.0.0"'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsf:xDocumentClass ${rootAttrs} xmlns:xsf="${XSF}" xmlns:xsf2="${XSF2}" xmlns:xsf3="${XSF3}" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
${inner}
</xsf:xDocumentClass>`;
}

export function manifestBytes(inner: string, rootAttrs?: string): Uint8Array {
  return encode(manifestXml(inner, rootAttrs), 'utf-8');
}
