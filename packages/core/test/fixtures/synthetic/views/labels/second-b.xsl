<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- A second view: the only place my:secondViewOnly appears, labelled by its left cell. -->
<xsl:template match="my:sheet"><html><body><table><tbody><tr>
<td>Approver comment</td>
<td><span xd:xctname="PlainText" xd:binding="my:secondViewOnly"/></td>
</tr></tbody></table></body></html></xsl:template>
</xsl:stylesheet>
