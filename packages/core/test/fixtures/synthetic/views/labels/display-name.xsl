<?xml version="1.0" encoding="UTF-8"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" xmlns:my="urn:my">
<!-- my:listTitle is bound nowhere; its schema carries ma:displayName. -->
<xsl:template match="my:sheet"><html><body><div>
<span title="Internal memo" xd:xctname="PlainText" xd:binding="my:tipOnly"/>
</div></body></html></xsl:template>
</xsl:stylesheet>
