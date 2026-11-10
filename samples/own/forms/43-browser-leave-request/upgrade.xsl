<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:43:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:browserLeaveRequest"><xsl:apply-templates select="my:browserLeaveRequest" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:browserLeaveRequest"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:browserLeaveRequest" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:employeeName">
				<xsl:choose>
					<xsl:when test="my:employeeName"><xsl:copy-of select="my:employeeName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:employeeEmail">
				<xsl:choose>
					<xsl:when test="my:employeeEmail"><xsl:copy-of select="my:employeeEmail/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:department">
				<xsl:choose>
					<xsl:when test="my:department"><xsl:copy-of select="my:department/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:firstDay">
					<xsl:copy-of select="my:firstDay"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:firstDay">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:lastDay">
					<xsl:copy-of select="my:lastDay"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:lastDay">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:halfDay">
				<xsl:choose>
					<xsl:when test="my:halfDay"><xsl:copy-of select="my:halfDay/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:comment">
				<xsl:choose>
					<xsl:when test="my:comment"><xsl:copy-of select="my:comment/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>

</xsl:stylesheet>
