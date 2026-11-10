<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:35:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:stationeryOrder"><xsl:apply-templates select="my:stationeryOrder" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:stationeryOrder"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:stationeryOrder" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:ordererName">
				<xsl:choose>
					<xsl:when test="my:ordererName"><xsl:copy-of select="my:ordererName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:deliverTo">
				<xsl:choose>
					<xsl:when test="my:deliverTo"><xsl:copy-of select="my:deliverTo/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:items"><xsl:apply-templates select="my:items[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:items"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:orderTotal">
					<xsl:copy-of select="my:orderTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:orderTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:item" mode="_2">
		<xsl:copy>
			<xsl:element name="my:itemText">
				<xsl:choose>
					<xsl:when test="my:itemText"><xsl:copy-of select="my:itemText/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:itemQty">
					<xsl:copy-of select="my:itemQty"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:itemQty">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:itemPrice">
					<xsl:copy-of select="my:itemPrice"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:itemPrice">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:itemTotal">
					<xsl:copy-of select="my:itemTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:itemTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:items" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:item" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
