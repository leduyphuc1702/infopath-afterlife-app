<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- The label in the left cell, with a trailing colon. -->
<xsl:template match="my:sheet"><html><body><table><tbody><tr>
<td>Contact phone:</td>
<td><span xd:xctname="PlainText" xd:binding="my:leftCellField"/></td>
</tr></tbody></table></body></html></xsl:template>
</xsl:stylesheet>
