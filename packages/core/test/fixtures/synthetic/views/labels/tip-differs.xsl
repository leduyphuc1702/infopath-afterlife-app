<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- A ScreenTip that differs from the cell text: the ScreenTip wins. -->
<xsl:template match="my:sheet"><html><body><table><tbody><tr>
<td>Ref</td>
<td><span title="Customer reference number" xd:xctname="PlainText" xd:binding="my:tipDiffers"/></td>
</tr></tbody></table></body></html></xsl:template>
</xsl:stylesheet>
