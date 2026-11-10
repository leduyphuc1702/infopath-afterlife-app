<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- A moded template that nothing calls. -->
<xsl:template match="my:order"><html><body>
<span title="Order title" xd:xctname="PlainText" xd:CtrlId="CTRL1" xd:binding="my:orderTitle"/>
</body></html></xsl:template>
<xsl:template match="my:line" mode="_9"><span title="Item" xd:xctname="PlainText" xd:CtrlId="CTRL2" xd:binding="my:item"/></xsl:template>
</xsl:stylesheet>
