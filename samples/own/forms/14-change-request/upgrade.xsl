<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:14:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:changeRequest"><xsl:apply-templates select="my:changeRequest" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:changeRequest"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:changeRequest" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:change"><xsl:apply-templates select="my:change[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:change"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:steps"><xsl:apply-templates select="my:steps[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:steps"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:cabApproved">
				<xsl:choose>
					<xsl:when test="my:cabApproved"><xsl:copy-of select="my:cabApproved/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:change" mode="_1">
		<xsl:copy>
			<xsl:element name="my:changeTitle">
				<xsl:choose>
					<xsl:when test="my:changeTitle"><xsl:copy-of select="my:changeTitle/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:systemAffected">
				<xsl:choose>
					<xsl:when test="my:systemAffected"><xsl:copy-of select="my:systemAffected/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:riskLevel">
				<xsl:choose>
					<xsl:when test="my:riskLevel"><xsl:copy-of select="my:riskLevel/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:plannedDate">
					<xsl:copy-of select="my:plannedDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:plannedDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:rollbackPlan">
				<xsl:choose>
					<xsl:when test="my:rollbackPlan"><xsl:copy-of select="my:rollbackPlan/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:step" mode="_3">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:stepOrder">
					<xsl:copy-of select="my:stepOrder"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:stepOrder">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:stepText">
				<xsl:choose>
					<xsl:when test="my:stepText"><xsl:copy-of select="my:stepText/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:stepOwner">
				<xsl:choose>
					<xsl:when test="my:stepOwner"><xsl:copy-of select="my:stepOwner/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:steps" mode="_2">
		<xsl:copy>
			<xsl:apply-templates select="my:step" mode="_3"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
