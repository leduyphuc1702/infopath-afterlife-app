<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:29:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:invoiceApproval"><xsl:apply-templates select="my:invoiceApproval" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:invoiceApproval"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:invoiceApproval" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:invoiceNumber">
				<xsl:choose>
					<xsl:when test="my:invoiceNumber"><xsl:copy-of select="my:invoiceNumber/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:vendorName">
				<xsl:choose>
					<xsl:when test="my:vendorName"><xsl:copy-of select="my:vendorName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:invoiceDate">
					<xsl:copy-of select="my:invoiceDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:invoiceDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:lines"><xsl:apply-templates select="my:lines[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:lines"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:netTotal">
					<xsl:copy-of select="my:netTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:netTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:taxRate">
					<xsl:copy-of select="my:taxRate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:taxRate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:grossTotal">
					<xsl:copy-of select="my:grossTotal"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:grossTotal">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:line" mode="_2">
		<xsl:copy>
			<xsl:element name="my:lineText">
				<xsl:choose>
					<xsl:when test="my:lineText"><xsl:copy-of select="my:lineText/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:lineQty">
					<xsl:copy-of select="my:lineQty"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:lineQty">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:linePrice">
					<xsl:copy-of select="my:linePrice"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:linePrice">
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
	<xsl:template match="my:lines" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:line" mode="_2"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
