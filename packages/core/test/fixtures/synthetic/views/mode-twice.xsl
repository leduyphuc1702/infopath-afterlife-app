<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- One moded template called from two places. -->
<xsl:template match="my:order"><html><body>
<div><xsl:apply-templates select="my:lines/my:line" mode="_1"/></div>
<div><xsl:apply-templates select="my:reviewers/my:Person" mode="_1"/></div>
</body></html></xsl:template>
<xsl:template match="*" mode="_1"><span title="Shared" xd:xctname="PlainText" xd:CtrlId="CTRL1" xd:binding="my:item"/></xsl:template>
</xsl:stylesheet>
