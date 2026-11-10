<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:23:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:nonConformance"><xsl:apply-templates select="my:nonConformance" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:nonConformance"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:nonConformance" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:ncrNumber">
				<xsl:choose>
					<xsl:when test="my:ncrNumber"><xsl:copy-of select="my:ncrNumber/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:raisedBy">
				<xsl:choose>
					<xsl:when test="my:raisedBy"><xsl:copy-of select="my:raisedBy/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:raisedOn">
					<xsl:copy-of select="my:raisedOn"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:raisedOn">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:category">
				<xsl:choose>
					<xsl:when test="my:category"><xsl:copy-of select="my:category/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:defectText">
				<xsl:apply-templates select="my:defectText/text() | my:defectText/*[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText"/>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:containment"><xsl:apply-templates select="my:containment[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:containment"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:closed">
				<xsl:choose>
					<xsl:when test="my:closed"><xsl:copy-of select="my:closed/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:containmentAction" mode="_2">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:containmentDate">
					<xsl:copy-of select="my:containmentDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:containmentDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:containmentText">
				<xsl:choose>
					<xsl:when test="my:containmentText"><xsl:copy-of select="my:containmentText/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:containment" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:containmentAction" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
