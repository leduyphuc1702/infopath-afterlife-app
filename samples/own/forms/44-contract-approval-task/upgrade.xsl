<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:44:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:contractApprovalTask"><xsl:apply-templates select="my:contractApprovalTask" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:contractApprovalTask"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:contractApprovalTask" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:contractTitle">
				<xsl:choose>
					<xsl:when test="my:contractTitle"><xsl:copy-of select="my:contractTitle/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:counterparty">
				<xsl:choose>
					<xsl:when test="my:counterparty"><xsl:copy-of select="my:counterparty/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:contractValue">
					<xsl:copy-of select="my:contractValue"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:contractValue">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:approvers"><xsl:apply-templates select="my:approvers[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:approvers"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:decision">
				<xsl:choose>
					<xsl:when test="my:decision"><xsl:copy-of select="my:decision/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:decisionNote">
				<xsl:choose>
					<xsl:when test="my:decisionNote"><xsl:copy-of select="my:decisionNote/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:Person" mode="_2">
		<xsl:copy>
			<xsl:element name="my:DisplayName">
				<xsl:choose>
					<xsl:when test="my:DisplayName"><xsl:copy-of select="my:DisplayName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:AccountId">
				<xsl:choose>
					<xsl:when test="my:AccountId"><xsl:copy-of select="my:AccountId/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:AccountType">
				<xsl:choose>
					<xsl:when test="my:AccountType"><xsl:copy-of select="my:AccountType/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:approvers" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:Person" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
