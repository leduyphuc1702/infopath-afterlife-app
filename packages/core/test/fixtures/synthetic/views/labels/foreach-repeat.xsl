<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- A repeating table drawn by xsl:for-each inside tbody xd:xctname="repeatingtable". -->
<xsl:template match="my:sheet"><html><body><table>
<tbody class="xdTableHeader"><tr><td><div>Visit date</div></td><td><div>Remarks</div></td></tr></tbody>
<tbody xd:xctname="repeatingtable"><xsl:for-each select="my:entries/my:entry"><tr>
<td><span xd:xctname="PlainText" xd:binding="my:entryDate"/></td>
<td><span xd:xctname="PlainText" xd:binding="my:entryNote"/></td>
</tr></xsl:for-each></tbody>
</table></body></html></xsl:template>
</xsl:stylesheet>
