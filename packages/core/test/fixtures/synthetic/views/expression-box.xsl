<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my" xmlns:xdXDocument="http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument" xmlns:xdMath="http://schemas.microsoft.com/office/infopath/2003/xslt/Math">
<!-- Two read-only expression boxes: an average over a repeating field, and a string literal. -->
<xsl:template match="my:order"><html><body><table><tbody><tr>
<td>Average quantity <span title="Average quantity" xd:xctname="ExpressionBox" xd:CtrlId="CTRL1" xd:binding="xdMath:Avg(my:lines/my:line/my:qty)" xd:disableEditing="yes"/></td>
<td><span xd:xctname="ExpressionBox" xd:CtrlId="CTRL2" xd:binding="string(&quot;Draft my:status&quot;)" xd:disableEditing="yes"/></td>
</tr></tbody></table></body></html></xsl:template>
</xsl:stylesheet>
