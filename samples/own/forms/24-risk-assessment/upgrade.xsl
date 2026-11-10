<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:24:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:riskAssessment"><xsl:apply-templates select="my:riskAssessment" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:riskAssessment"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:riskAssessment" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:activityName">
				<xsl:choose>
					<xsl:when test="my:activityName"><xsl:copy-of select="my:activityName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:assessor">
				<xsl:choose>
					<xsl:when test="my:assessor"><xsl:copy-of select="my:assessor/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:risks"><xsl:apply-templates select="my:risks[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:risks"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:risk" mode="_2">
		<xsl:copy>
			<xsl:element name="my:hazard">
				<xsl:choose>
					<xsl:when test="my:hazard"><xsl:copy-of select="my:hazard/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:likelihood">
					<xsl:copy-of select="my:likelihood"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:likelihood">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:consequence">
					<xsl:copy-of select="my:consequence"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:consequence">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:riskScore">
					<xsl:copy-of select="my:riskScore"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:riskScore">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:control">
				<xsl:choose>
					<xsl:when test="my:control"><xsl:copy-of select="my:control/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:risks" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:risk" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
