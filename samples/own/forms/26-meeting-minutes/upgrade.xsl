<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:26:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:meetingMinutes"><xsl:apply-templates select="my:meetingMinutes" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:meetingMinutes"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:meetingMinutes" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:element name="my:meetingTitle">
				<xsl:choose>
					<xsl:when test="my:meetingTitle"><xsl:copy-of select="my:meetingTitle/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:meetingDate">
					<xsl:copy-of select="my:meetingDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:meetingDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:chair">
				<xsl:choose>
					<xsl:when test="my:chair"><xsl:copy-of select="my:chair/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:attendees"><xsl:apply-templates select="my:attendees[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:attendees"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:decisions">
				<xsl:apply-templates select="my:decisions/text() | my:decisions/*[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText"/>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:actions"><xsl:apply-templates select="my:actions[1]" mode="_3"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:actions"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_3"/></xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:attendee" mode="_2">
		<xsl:copy>
			<xsl:element name="my:attendeeName">
				<xsl:choose>
					<xsl:when test="my:attendeeName"><xsl:copy-of select="my:attendeeName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:attendeeOrg">
				<xsl:choose>
					<xsl:when test="my:attendeeOrg"><xsl:copy-of select="my:attendeeOrg/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:attendeePresent">
				<xsl:choose>
					<xsl:when test="my:attendeePresent"><xsl:copy-of select="my:attendeePresent/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:attendees" mode="_1">
		<xsl:copy>
			<xsl:apply-templates select="my:attendee" mode="_2"/>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:action" mode="_4">
		<xsl:copy>
			<xsl:element name="my:actionText">
				<xsl:choose>
					<xsl:when test="my:actionText"><xsl:copy-of select="my:actionText/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:actionOwner">
				<xsl:choose>
					<xsl:when test="my:actionOwner"><xsl:copy-of select="my:actionOwner/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:actionDue">
					<xsl:copy-of select="my:actionDue"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:actionDue">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:actions" mode="_3">
		<xsl:copy>
			<xsl:apply-templates select="my:action" mode="_4"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
