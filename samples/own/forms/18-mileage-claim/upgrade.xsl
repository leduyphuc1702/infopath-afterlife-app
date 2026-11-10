<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:18:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:mileageClaim"><xsl:apply-templates select="my:mileageClaim" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:mileageClaim"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:mileageClaim" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:claimantName">
				<xsl:choose>
					<xsl:when test="my:claimantName"><xsl:copy-of select="my:claimantName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:trips"><xsl:apply-templates select="my:trips[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:trips"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:claimTotal">
					<xsl:copy-of select="my:claimTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:claimTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:trip" mode="_2">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:tripDate">
					<xsl:copy-of select="my:tripDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:tripDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:tripFrom">
				<xsl:choose>
					<xsl:when test="my:tripFrom"><xsl:copy-of select="my:tripFrom/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:tripTo">
				<xsl:choose>
					<xsl:when test="my:tripTo"><xsl:copy-of select="my:tripTo/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:tripKm">
					<xsl:copy-of select="my:tripKm"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:tripKm">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:tripRate">
					<xsl:copy-of select="my:tripRate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:tripRate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:tripAmount">
					<xsl:copy-of select="my:tripAmount"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:tripAmount">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:trips" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:trip" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
