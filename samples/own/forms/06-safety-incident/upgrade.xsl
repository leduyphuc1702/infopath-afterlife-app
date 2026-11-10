<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:50:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:incidentReport"><xsl:apply-templates select="my:incidentReport" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:incidentReport"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:incidentReport" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:reporter"><xsl:apply-templates select="my:reporter[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:reporter"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:occurredAt">
					<xsl:copy-of select="my:occurredAt"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:occurredAt">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:site">
				<xsl:choose>
					<xsl:when test="my:site"><xsl:copy-of select="my:site/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:locationDetail">
				<xsl:choose>
					<xsl:when test="my:locationDetail"><xsl:copy-of select="my:locationDetail/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:severity">
				<xsl:choose>
					<xsl:when test="my:severity"><xsl:copy-of select="my:severity/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:incidentDescription">
				<xsl:apply-templates select="my:incidentDescription/text() | my:incidentDescription/*[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText"/>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:scenePhoto">
					<xsl:copy-of select="my:scenePhoto"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:scenePhoto">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:persons"><xsl:apply-templates select="my:persons[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:persons"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:reporter" mode="_1">
		<xsl:copy>
			<xsl:element name="my:reporterName">
				<xsl:choose>
					<xsl:when test="my:reporterName"><xsl:copy-of select="my:reporterName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:reporterPhone">
				<xsl:choose>
					<xsl:when test="my:reporterPhone"><xsl:copy-of select="my:reporterPhone/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:followUp" mode="_5">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:actionDate">
					<xsl:copy-of select="my:actionDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:actionDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:actionTaken">
				<xsl:choose>
					<xsl:when test="my:actionTaken"><xsl:copy-of select="my:actionTaken/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:actionOwner">
				<xsl:choose>
					<xsl:when test="my:actionOwner"><xsl:copy-of select="my:actionOwner/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:followUps" mode="_4">
		<xsl:copy>
			<xsl:apply-templates select="my:followUp" mode="_5"/>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:person" mode="_3">
		<xsl:copy>
			<xsl:element name="my:personName">
				<xsl:choose>
					<xsl:when test="my:personName"><xsl:copy-of select="my:personName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:personRole">
				<xsl:choose>
					<xsl:when test="my:personRole"><xsl:copy-of select="my:personRole/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:injuryType">
				<xsl:choose>
					<xsl:when test="my:injuryType"><xsl:copy-of select="my:injuryType/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:followUps"><xsl:apply-templates select="my:followUps[1]" mode="_4"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:followUps"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_4"/></xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:persons" mode="_2">
		<xsl:copy>
			<xsl:apply-templates select="my:person" mode="_3"/>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
