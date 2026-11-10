<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:33:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:badgeRequest"><xsl:apply-templates select="my:badgeRequest" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:badgeRequest"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:badgeRequest" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:requester"><xsl:apply-templates select="my:requester[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:requester"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:subject">
				<xsl:choose>
					<xsl:when test="my:subject"><xsl:copy-of select="my:subject/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:neededBy">
					<xsl:copy-of select="my:neededBy"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:neededBy">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:badgeType">
				<xsl:choose>
					<xsl:when test="my:badgeType"><xsl:copy-of select="my:badgeType/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:site">
				<xsl:choose>
					<xsl:when test="my:site"><xsl:copy-of select="my:site/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:photoTaken">
				<xsl:choose>
					<xsl:when test="my:photoTaken"><xsl:copy-of select="my:photoTaken/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:justification">
				<xsl:choose>
					<xsl:when test="my:justification"><xsl:copy-of select="my:justification/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:ownerEmail">
				<xsl:choose>
					<xsl:when test="my:ownerEmail"><xsl:copy-of select="my:ownerEmail/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:requester" mode="_1">
		<xsl:copy>
			<xsl:element name="my:requesterName">
				<xsl:choose>
					<xsl:when test="my:requesterName"><xsl:copy-of select="my:requesterName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:requesterEmail">
				<xsl:choose>
					<xsl:when test="my:requesterEmail"><xsl:copy-of select="my:requesterEmail/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:requesterDept">
				<xsl:choose>
					<xsl:when test="my:requesterDept"><xsl:copy-of select="my:requesterDept/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
