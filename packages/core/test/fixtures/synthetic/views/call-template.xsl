<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- A control inside a named template reached by xsl:call-template. -->
<xsl:template match="my:order"><html><body>
<xsl:call-template name="statusBlock"/>
</body></html></xsl:template>
<xsl:template name="statusBlock"><span title="Status" xd:xctname="PlainText" xd:CtrlId="CTRL1" xd:binding="my:status"/></xsl:template>
</xsl:stylesheet>
