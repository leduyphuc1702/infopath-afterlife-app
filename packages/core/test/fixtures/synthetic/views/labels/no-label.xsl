<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- No ScreenTip, no text, no cells: the name in Title Case. -->
<xsl:template match="my:sheet"><html><body><div>
<span xd:xctname="PlainText" xd:binding="my:noLabel"/>
</div></body></html></xsl:template>
</xsl:stylesheet>
