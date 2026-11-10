<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- A text box bound into the secondary source Depots; the z prefix is declared on the control. -->
<xsl:template match="my:order"><html><body>
<span title="Depot" xd:xctname="PlainText" xd:CtrlId="CTRL1" xmlns:z="#RowsetSchema" xd:binding="xdXDocument:GetDOM(&quot;Depots&quot;)/z:row/@ows_Depot"/>
<select title="Region" xd:xctname="dropdown" xd:CtrlId="CTRL2" xd:binding="my:status" xmlns:z="#RowsetSchema"><xsl:for-each select="xdXDocument:GetDOM(&quot;Depots&quot;)/z:row[@ows_Region = current()/my:orderTitle]"><option><xsl:value-of select="@ows_Depot"/></option></xsl:for-each></select>
</body></html></xsl:template>
</xsl:stylesheet>
