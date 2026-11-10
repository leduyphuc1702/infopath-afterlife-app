<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- xctname case: DropDown next to dropdown. -->
<xsl:template match="my:order"><html><body>
<select title="Status" xd:xctname="DropDown" xd:CtrlId="CTRL1" xd:binding="my:status"><option value="Open">Open</option></select>
<select title="Title" xd:xctname="dropdown" xd:CtrlId="CTRL2" xd:binding="my:orderTitle"><option value="A">A</option></select>
</body></html></xsl:template>
</xsl:stylesheet>
