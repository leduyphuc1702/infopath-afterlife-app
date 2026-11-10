<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:45:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:policyAcknowledgement"><xsl:apply-templates select="my:policyAcknowledgement" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:policyAcknowledgement"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:policyAcknowledgement" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:employeeName">
				<xsl:choose>
					<xsl:when test="my:employeeName"><xsl:copy-of select="my:employeeName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:employeeId">
				<xsl:choose>
					<xsl:when test="my:employeeId"><xsl:copy-of select="my:employeeId/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:policyName">
				<xsl:choose>
					<xsl:when test="my:policyName"><xsl:copy-of select="my:policyName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:policyVersion">
				<xsl:choose>
					<xsl:when test="my:policyVersion"><xsl:copy-of select="my:policyVersion/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:readAndUnderstood">
				<xsl:choose>
					<xsl:when test="my:readAndUnderstood"><xsl:copy-of select="my:readAndUnderstood/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:acknowledgedOn">
					<xsl:copy-of select="my:acknowledgedOn"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:acknowledgedOn">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		<xsl:choose><xsl:when test="my:signatures1"><xsl:apply-templates select="my:signatures1[1]" mode="_sig"/></xsl:when><xsl:otherwise><my:signatures1><my:signatures2/></my:signatures1></xsl:otherwise></xsl:choose></xsl:copy>
	</xsl:template>

	<xsl:template match="my:signatures1" mode="_sig">
		<xsl:copy>
			<xsl:element name="my:signatures2">
				<xsl:copy-of select="my:signatures2[1]/*[namespace-uri() = 'http://www.w3.org/2000/09/xmldsig#']"/>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
