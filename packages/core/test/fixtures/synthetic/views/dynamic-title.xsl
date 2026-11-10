<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- A ScreenTip computed at run time ({…}), and one escaped with {{ }}. -->
<xsl:template match="my:order"><html><body>
<span title="{my:orderTitle}" xd:xctname="PlainText" xd:CtrlId="CTRL1" xd:binding="my:status"/>
<span title="Code {{A}}" xd:xctname="PlainText" xd:CtrlId="CTRL2" xd:binding="my:orderTitle"/>
</body></html></xsl:template>
</xsl:stylesheet>
