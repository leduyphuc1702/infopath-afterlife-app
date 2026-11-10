<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- A block above the control in the same cell. -->
<xsl:template match="my:sheet"><html><body><table><tbody><tr>
<td><div><strong>Site</strong><xsl:text> address</xsl:text></div>
<div><span xd:xctname="PlainText" xd:binding="my:blockAbove"/></div></td>
</tr></tbody></table></body></html></xsl:template>
</xsl:stylesheet>
