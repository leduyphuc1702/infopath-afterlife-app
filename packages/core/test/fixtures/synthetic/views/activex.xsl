<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- A person picker: ActiveX object, {{…}} in xd:xctname, bound to a group, xd:server on a single-label host. -->
<xsl:template match="my:order"><html><body>
<object class="xdActiveX" classid="clsid:00000000-0000-0000-0000-0000000beef0" xd:xctname="{{00000000-0000-0000-0000-0000000beef0}}" xd:CtrlId="CTRL1" xd:server="http://peoplehub:8080" xd:boundProp="xd:inline" xd:binding="my:reviewers"><param name="Mode" value="multi"/></object>
</body></html></xsl:template>
</xsl:stylesheet>
