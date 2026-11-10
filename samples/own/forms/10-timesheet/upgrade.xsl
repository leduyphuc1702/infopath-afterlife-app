<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:10:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:timesheet"><xsl:apply-templates select="my:timesheet" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:timesheet"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:timesheet" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:employee"><xsl:apply-templates select="my:employee[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:employee"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:lines"><xsl:apply-templates select="my:lines[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:lines"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:totalHours">
					<xsl:copy-of select="my:totalHours"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:totalHours">
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
	<xsl:template match="my:employee" mode="_1">
		<xsl:copy>
			<xsl:element name="my:employeeName">
				<xsl:choose>
					<xsl:when test="my:employeeName"><xsl:copy-of select="my:employeeName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:employeeId">
				<xsl:choose>
					<xsl:when test="my:employeeId"><xsl:copy-of select="my:employeeId/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:weekStart">
					<xsl:copy-of select="my:weekStart"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:weekStart">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:day" mode="_3">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:workDate">
					<xsl:copy-of select="my:workDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:workDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:hoursWorked">
					<xsl:copy-of select="my:hoursWorked"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:hoursWorked">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:projectCode">
				<xsl:choose>
					<xsl:when test="my:projectCode"><xsl:copy-of select="my:projectCode/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:note">
				<xsl:choose>
					<xsl:when test="my:note"><xsl:copy-of select="my:note/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:lines" mode="_2">
		<xsl:copy>
			<xsl:apply-templates select="my:day" mode="_3"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
