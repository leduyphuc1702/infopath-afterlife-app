<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:40:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:supplierScorecard"><xsl:apply-templates select="my:supplierScorecard" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:supplierScorecard"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:supplierScorecard" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:supplierName">
				<xsl:choose>
					<xsl:when test="my:supplierName"><xsl:copy-of select="my:supplierName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:period">
				<xsl:choose>
					<xsl:when test="my:period"><xsl:copy-of select="my:period/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:scores"><xsl:apply-templates select="my:scores[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:scores"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:scoreTotal">
					<xsl:copy-of select="my:scoreTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:scoreTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:reviewedBy">
				<xsl:choose>
					<xsl:when test="my:reviewedBy"><xsl:copy-of select="my:reviewedBy/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:score" mode="_2">
		<xsl:copy>
			<xsl:element name="my:scoreArea">
				<xsl:choose>
					<xsl:when test="my:scoreArea"><xsl:copy-of select="my:scoreArea/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:scoreValue">
					<xsl:copy-of select="my:scoreValue"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:scoreValue">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:scoreNote">
				<xsl:choose>
					<xsl:when test="my:scoreNote"><xsl:copy-of select="my:scoreNote/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:scores" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:score" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
