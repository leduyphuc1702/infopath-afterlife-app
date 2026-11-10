<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- Inline text before the control in its own cell; an empty ScreenTip. -->
<xsl:template match="my:sheet"><html><body><table><tbody><tr>
<td>Delivery   note: <span title="" xd:xctname="PlainText" xd:binding="my:inlineBefore"/></td>
</tr></tbody></table></body></html></xsl:template>
</xsl:stylesheet>
