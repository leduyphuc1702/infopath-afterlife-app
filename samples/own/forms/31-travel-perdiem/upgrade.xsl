<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:31:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:travelPerdiem"><xsl:apply-templates select="my:travelPerdiem" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:travelPerdiem"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:travelPerdiem" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:travelerName">
				<xsl:choose>
					<xsl:when test="my:travelerName"><xsl:copy-of select="my:travelerName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:destination">
				<xsl:choose>
					<xsl:when test="my:destination"><xsl:copy-of select="my:destination/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:days"><xsl:apply-templates select="my:days[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:days"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:perDiemTotal">
					<xsl:copy-of select="my:perDiemTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:perDiemTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:day" mode="_2">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:dayDate">
					<xsl:copy-of select="my:dayDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:dayDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:dayMeals">
					<xsl:copy-of select="my:dayMeals"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:dayMeals">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:dayLodging">
					<xsl:copy-of select="my:dayLodging"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:dayLodging">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:dayTotal">
					<xsl:copy-of select="my:dayTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:dayTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:days" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:day" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
