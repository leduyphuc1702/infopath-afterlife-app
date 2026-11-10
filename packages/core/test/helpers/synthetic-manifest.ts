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

/**
 * Spec 01's print-settings fixture (test/xsf/build.views.test.ts): view `Main` names `Print` as
 * its print view, with print settings, a merged print view and view extensions. Also used by
 * spec 02 R4.1 (`isPrint`, `printView`).
 */
export const PRINT_SETTINGS_FIXTURE = `<xsf:views default="Main">
  <xsf:view name="Main" caption="Main" printView="Print" showMenuItem="yes" designMode="normal">
    <xsf:mainpane transform="view1.xsl"/>
    <xsf:printSettings orientation="landscape" marginUnitsType="cm" topMargin="1.5" header="H" footer="F">
      <xsf:header><b>Page</b> &amp;p of &amp;P</xsf:header>
      <xsf:footer>  Confidential  </xsf:footer>
    </xsf:printSettings>
    <xsf:toolbar name="tb" caption="Tools"><xsf:button action="xCollection::insert" xmlToEdit="row" caption="Add"/></xsf:toolbar>
  </xsf:view>
  <xsf:view name="Print"><xsf:mainpane transform="view2.xsl"/></xsf:view>
</xsf:views>
<xsf:extensions><xsf:extension name="SolutionDefinitionExtensions">
  <xsf2:solutionDefinition>
    <xsf2:viewsExtension><xsf2:viewExtension ref="Print" readOnly="yes"/><xsf2:viewExtension ref="Gone"/></xsf2:viewsExtension>
    <xsf2:mergedPrintView isDefault="yes" viewBreak="pageBreak">
      <xsf:printSettings orientation="portrait"/>
      <xsf2:includedViews><xsf2:includedView name="Main"/><xsf2:includedView name="Print"/></xsf2:includedViews>
    </xsf2:mergedPrintView>
  </xsf2:solutionDefinition>
  <xsf3:solutionDefinition>
    <xsf3:viewsExtension><xsf3:viewExtension ref="Main"/></xsf3:viewsExtension>
  </xsf3:solutionDefinition>
</xsf:extension></xsf:extensions>`;
