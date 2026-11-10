<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:09:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:itAccessRequest"><xsl:apply-templates select="my:itAccessRequest" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:itAccessRequest"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:itAccessRequest" mode="_0">
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
			<xsl:choose>
				<xsl:when test="my:access"><xsl:apply-templates select="my:access[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:access"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
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
	<xsl:template match="my:access" mode="_2">
		<xsl:copy>
			<xsl:element name="my:systemName">
				<xsl:choose>
					<xsl:when test="my:systemName"><xsl:copy-of select="my:systemName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:accessLevel">
				<xsl:choose>
					<xsl:when test="my:accessLevel"><xsl:copy-of select="my:accessLevel/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:startDate">
					<xsl:copy-of select="my:startDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:startDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:endDate">
					<xsl:copy-of select="my:endDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:endDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:permanent">
				<xsl:choose>
					<xsl:when test="my:permanent"><xsl:copy-of select="my:permanent/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
