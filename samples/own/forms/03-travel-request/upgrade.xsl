<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:20:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:travelRequest"><xsl:apply-templates select="my:travelRequest" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:travelRequest"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:travelRequest" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:traveler"><xsl:apply-templates select="my:traveler[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:traveler"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:tripType">
				<xsl:choose>
					<xsl:when test="my:tripType"><xsl:copy-of select="my:tripType/text()[1]"/></xsl:when>
					<xsl:otherwise>Domestic</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:destCountry">
				<xsl:choose>
					<xsl:when test="my:destCountry"><xsl:copy-of select="my:destCountry/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:destCity">
				<xsl:choose>
					<xsl:when test="my:destCity"><xsl:copy-of select="my:destCity/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:departDate">
					<xsl:copy-of select="my:departDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:departDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:returnDate">
					<xsl:copy-of select="my:returnDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:returnDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:purpose">
				<xsl:choose>
					<xsl:when test="my:purpose"><xsl:copy-of select="my:purpose/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:international"><xsl:apply-templates select="my:international[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:international"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:accounting"><xsl:apply-templates select="my:accounting[1]" mode="_3"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:accounting"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_3"/></xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:traveler" mode="_1">
		<xsl:copy>
			<xsl:element name="my:travelerName">
				<xsl:choose>
					<xsl:when test="my:travelerName"><xsl:copy-of select="my:travelerName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:travelerEmail">
				<xsl:choose>
					<xsl:when test="my:travelerEmail"><xsl:copy-of select="my:travelerEmail/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:travelerDept">
				<xsl:choose>
					<xsl:when test="my:travelerDept"><xsl:copy-of select="my:travelerDept/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:international" mode="_2">
		<xsl:copy>
			<xsl:element name="my:passportNumber">
				<xsl:choose>
					<xsl:when test="my:passportNumber"><xsl:copy-of select="my:passportNumber/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:passportExpiry">
					<xsl:copy-of select="my:passportExpiry"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:passportExpiry">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:visaRequired">
				<xsl:choose>
					<xsl:when test="my:visaRequired"><xsl:copy-of select="my:visaRequired/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:travelInsurance">
				<xsl:choose>
					<xsl:when test="my:travelInsurance"><xsl:copy-of select="my:travelInsurance/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:accounting" mode="_3">
		<xsl:copy>
			<xsl:element name="my:costCenter">
				<xsl:choose>
					<xsl:when test="my:costCenter"><xsl:copy-of select="my:costCenter/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:estimatedCost">
					<xsl:copy-of select="my:estimatedCost"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:estimatedCost">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:advanceAmount">
					<xsl:copy-of select="my:advanceAmount"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:advanceAmount">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:accountingApprover">
				<xsl:choose>
					<xsl:when test="my:accountingApprover"><xsl:copy-of select="my:accountingApprover/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:accountingStatus">
				<xsl:choose>
					<xsl:when test="my:accountingStatus"><xsl:copy-of select="my:accountingStatus/text()[1]"/></xsl:when>
					<xsl:otherwise>Pending</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
