<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:47:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:assetCheckoutScript"><xsl:apply-templates select="my:assetCheckoutScript" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:assetCheckoutScript"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:assetCheckoutScript" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:assetTag">
				<xsl:choose>
					<xsl:when test="my:assetTag"><xsl:copy-of select="my:assetTag/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:assetCondition">
				<xsl:choose>
					<xsl:when test="my:assetCondition"><xsl:copy-of select="my:assetCondition/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:borrower"><xsl:apply-templates select="my:borrower[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:borrower"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:checkoutDate">
					<xsl:copy-of select="my:checkoutDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:checkoutDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:returnDue">
					<xsl:copy-of select="my:returnDue"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:returnDue">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:borrower" mode="_1">
		<xsl:copy>
			<xsl:element name="my:borrowerName">
				<xsl:choose>
					<xsl:when test="my:borrowerName"><xsl:copy-of select="my:borrowerName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:borrowerEmail">
				<xsl:choose>
					<xsl:when test="my:borrowerEmail"><xsl:copy-of select="my:borrowerEmail/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
