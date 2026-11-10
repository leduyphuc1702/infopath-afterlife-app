<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:46:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:vendorOnboardingCode"><xsl:apply-templates select="my:vendorOnboardingCode" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:vendorOnboardingCode"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:vendorOnboardingCode" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:vendorName">
				<xsl:choose>
					<xsl:when test="my:vendorName"><xsl:copy-of select="my:vendorName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:taxId">
				<xsl:choose>
					<xsl:when test="my:taxId"><xsl:copy-of select="my:taxId/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:country">
				<xsl:choose>
					<xsl:when test="my:country"><xsl:copy-of select="my:country/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:bankAccount">
				<xsl:choose>
					<xsl:when test="my:bankAccount"><xsl:copy-of select="my:bankAccount/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:approved">
				<xsl:choose>
					<xsl:when test="my:approved"><xsl:copy-of select="my:approved/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>

</xsl:stylesheet>
