<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- Two checkboxes in one cell with ScreenTips, and two in another cell without. -->
<xsl:template match="my:sheet"><html><body><table><tbody>
<tr><td><input type="checkbox" title="Urgent handling" xd:xctname="CheckBox" xd:binding="my:urgent"/> Urgent <input type="checkbox" title="Fragile goods" xd:xctname="CheckBox" xd:binding="my:fragile"/> Fragile</td></tr>
<tr><td><input type="checkbox" xd:xctname="CheckBox" xd:binding="my:sealed"/> Sealed
<input type="checkbox" xd:xctname="CheckBox" xd:binding="my:insured"/> Insured</td></tr>
</tbody></table></body></html></xsl:template>
</xsl:stylesheet>
