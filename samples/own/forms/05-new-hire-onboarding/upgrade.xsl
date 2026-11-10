<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T08:40:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:onboarding"><xsl:apply-templates select="my:onboarding" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:onboarding"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:onboarding" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:newHire"><xsl:apply-templates select="my:newHire[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:newHire"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:employment"><xsl:apply-templates select="my:employment[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:employment"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:equipment"><xsl:apply-templates select="my:equipment[1]" mode="_5"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:equipment"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_5"/></xsl:otherwise>
			</xsl:choose>
			<xsl:apply-templates select="my:relocation[1]" mode="_6"/>
			<xsl:element name="my:welcomeNote">
				<xsl:apply-templates select="my:welcomeNote/text() | my:welcomeNote/*[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText"/>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:newHire" mode="_1">
		<xsl:copy>
			<xsl:element name="my:hireName">
				<xsl:choose>
					<xsl:when test="my:hireName"><xsl:copy-of select="my:hireName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:hireStartDate">
					<xsl:copy-of select="my:hireStartDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:hireStartDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:hireTitle">
				<xsl:choose>
					<xsl:when test="my:hireTitle"><xsl:copy-of select="my:hireTitle/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:hireDept">
				<xsl:choose>
					<xsl:when test="my:hireDept"><xsl:copy-of select="my:hireDept/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:hireManager">
				<xsl:choose>
					<xsl:when test="my:hireManager"><xsl:copy-of select="my:hireManager/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:fullTime" mode="_3">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:annualSalary">
					<xsl:copy-of select="my:annualSalary"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:annualSalary">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:benefitsPlan">
				<xsl:choose>
					<xsl:when test="my:benefitsPlan"><xsl:copy-of select="my:benefitsPlan/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:contractor" mode="_4">
		<xsl:copy>
			<xsl:element name="my:agencyName">
				<xsl:choose>
					<xsl:when test="my:agencyName"><xsl:copy-of select="my:agencyName/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:hourlyRate">
					<xsl:copy-of select="my:hourlyRate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:hourlyRate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:contractEnd">
					<xsl:copy-of select="my:contractEnd"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:contractEnd">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:employment" mode="_2">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:fullTime"><xsl:apply-templates select="my:fullTime[1]" mode="_3"/></xsl:when>
				<xsl:when test="my:contractor"><xsl:apply-templates select="my:contractor[1]" mode="_4"/></xsl:when>
				<xsl:otherwise><xsl:element name="my:fullTime"/></xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:equipment" mode="_5">
		<xsl:copy>
			<xsl:element name="my:needsLaptop">
				<xsl:choose>
					<xsl:when test="my:needsLaptop"><xsl:copy-of select="my:needsLaptop/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:needsPhone">
				<xsl:choose>
					<xsl:when test="my:needsPhone"><xsl:copy-of select="my:needsPhone/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:needsMonitor">
				<xsl:choose>
					<xsl:when test="my:needsMonitor"><xsl:copy-of select="my:needsMonitor/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:accountsNeeded">
				<xsl:choose>
					<xsl:when test="my:accountsNeeded"><xsl:copy-of select="my:accountsNeeded/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:relocation" mode="_6">
		<xsl:copy>
			<xsl:element name="my:relocateFrom">
				<xsl:choose>
					<xsl:when test="my:relocateFrom"><xsl:copy-of select="my:relocateFrom/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:relocationAllowance">
					<xsl:copy-of select="my:relocationAllowance"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:relocationAllowance">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:movingDate">
					<xsl:copy-of select="my:movingDate"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:movingDate">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
