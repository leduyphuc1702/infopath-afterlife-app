<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- A repeating table drawn by a moded template; column headers in the head row. -->
<xsl:template match="my:sheet"><html><body><table>
<thead><tr><th>Part</th><th>Count</th></tr></thead>
<tbody><xsl:apply-templates select="my:rows/my:row" mode="_1"/></tbody>
</table></body></html></xsl:template>
<xsl:template match="my:row" mode="_1"><tr>
<td><span xd:xctname="PlainText" xd:binding="my:rowItem"/></td>
<td><span xd:xctname="PlainText" xd:binding="my:rowQty"/></td>
</tr></xsl:template>
</xsl:stylesheet>
