<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- A "Pick" button in each repeating row (CTRL7); a rule run by it writes ../my:selectedRow. -->
<xsl:template match="my:order"><html><body><table>
<thead><tr><th>Part</th><th></th></tr></thead>
<tbody xd:xctname="RepeatingTable"><xsl:apply-templates select="my:lines/my:line" mode="_1"/></tbody>
</table></body></html></xsl:template>
<xsl:template match="my:line" mode="_1"><tr>
<td><span title="Part" xd:xctname="PlainText" xd:CtrlId="CTRL6" xd:binding="my:item"/></td>
<td><input type="button" value="Pick" xd:xctname="Button" xd:CtrlId="CTRL7"/></td>
</tr></xsl:template>
</xsl:stylesheet>
