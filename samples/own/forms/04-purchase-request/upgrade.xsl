<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:30:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:purchaseRequest"><xsl:apply-templates select="my:purchaseRequest" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:purchaseRequest"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:purchaseRequest" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:requester"><xsl:apply-templates select="my:requester[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:requester"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:vendorId">
				<xsl:choose>
					<xsl:when test="my:vendorId"><xsl:copy-of select="my:vendorId/text()[1]"/></xsl:when>
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
				<xsl:when test="my:lines"><xsl:apply-templates select="my:lines[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:lines"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:subtotal">
					<xsl:copy-of select="my:subtotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:subtotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:vatRate">
					<xsl:copy-of select="my:vatRate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:vatRate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:vatAmount">
					<xsl:copy-of select="my:vatAmount"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:vatAmount">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:grandTotal">
					<xsl:copy-of select="my:grandTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:grandTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:budgetRemaining">
					<xsl:copy-of select="my:budgetRemaining"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:budgetRemaining">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:needsAccounting">
				<xsl:choose>
					<xsl:when test="my:needsAccounting"><xsl:copy-of select="my:needsAccounting/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:justification">
				<xsl:choose>
					<xsl:when test="my:justification"><xsl:copy-of select="my:justification/text()[1]"/></xsl:when>
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
			<xsl:element name="my:costCenterCode">
				<xsl:choose>
					<xsl:when test="my:costCenterCode"><xsl:copy-of select="my:costCenterCode/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:line" mode="_3">
		<xsl:copy>
			<xsl:element name="my:lineDescription">
				<xsl:choose>
					<xsl:when test="my:lineDescription"><xsl:copy-of select="my:lineDescription/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:quantity">
					<xsl:copy-of select="my:quantity"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:quantity">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:unitPrice">
					<xsl:copy-of select="my:unitPrice"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:unitPrice">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:lineTotal">
					<xsl:copy-of select="my:lineTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:lineTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:lines" mode="_2">
		<xsl:copy>
			<xsl:apply-templates select="my:line" mode="_3"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
