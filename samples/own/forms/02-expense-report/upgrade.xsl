<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:10:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:expenseClaim"><xsl:apply-templates select="my:expenseClaim" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:expenseClaim"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:expenseClaim" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:claimant"><xsl:apply-templates select="my:claimant[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:claimant"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:businessPurpose">
				<xsl:choose>
					<xsl:when test="my:businessPurpose"><xsl:copy-of select="my:businessPurpose/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:claimCurrency">
				<xsl:choose>
					<xsl:when test="my:claimCurrency"><xsl:copy-of select="my:claimCurrency/text()[1]"/></xsl:when>
					<xsl:otherwise>USD</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:expenses"><xsl:apply-templates select="my:expenses[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:expenses"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:totalAmount">
					<xsl:copy-of select="my:totalAmount"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:totalAmount">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:approverEmail">
				<xsl:choose>
					<xsl:when test="my:approverEmail"><xsl:copy-of select="my:approverEmail/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:claimant" mode="_1">
		<xsl:copy>
			<xsl:element name="my:claimantName">
				<xsl:choose>
					<xsl:when test="my:claimantName"><xsl:copy-of select="my:claimantName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:claimantId">
				<xsl:choose>
					<xsl:when test="my:claimantId"><xsl:copy-of select="my:claimantId/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:claimantDept">
				<xsl:choose>
					<xsl:when test="my:claimantDept"><xsl:copy-of select="my:claimantDept/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:expense" mode="_3">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:expenseDate">
					<xsl:copy-of select="my:expenseDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:expenseDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:expenseType">
				<xsl:choose>
					<xsl:when test="my:expenseType"><xsl:copy-of select="my:expenseType/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:expenseDescription">
				<xsl:choose>
					<xsl:when test="my:expenseDescription"><xsl:copy-of select="my:expenseDescription/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:amount">
					<xsl:copy-of select="my:amount"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:amount">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:receipt">
					<xsl:copy-of select="my:receipt"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:receipt">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:expenses" mode="_2">
		<xsl:copy>
			<xsl:apply-templates select="my:expense" mode="_3"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
