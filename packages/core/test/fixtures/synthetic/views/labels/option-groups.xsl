<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- Two option-button groups: one labelled by its left cell, one by its first button's ScreenTip. -->
<xsl:template match="my:sheet"><html><body><table><tbody>
<tr><td>Priority</td><td><input type="radio" title="" xd:xctname="OptionButton" xd:binding="my:priority" xd:onValue="high"/> High <input type="radio" title="" xd:xctname="OptionButton" xd:binding="my:priority" xd:onValue="low"/> Low</td></tr>
<tr><td></td><td><input type="radio" title="Shipping method" xd:xctname="OptionButton" xd:binding="my:shipping" xd:onValue="road"/> Road <input type="radio" title="" xd:xctname="OptionButton" xd:binding="my:shipping" xd:onValue="air"/> Air</td></tr>
</tbody></table></body></html></xsl:template>
</xsl:stylesheet>
