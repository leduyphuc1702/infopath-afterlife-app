<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:msxsl="urn:schemas-microsoft-com:xslt" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-03T09:00:00" xmlns:xd="http://schemas.microsoft.com/office/infopath/2003" version="1.0">
	<xsl:output encoding="UTF-8" method="xml"/>
	<xsl:template match="text() | *[namespace-uri()='http://www.w3.org/1999/xhtml']" mode="RichText">
		<xsl:copy-of select="."/>
	</xsl:template>
	<xsl:template match="/">
		<xsl:copy-of select="processing-instruction() | comment()"/>
		<xsl:choose>
			<xsl:when test="my:bigForm"><xsl:apply-templates select="my:bigForm" mode="_0"/></xsl:when>
			<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:bigForm"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_0"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="my:bigForm" mode="_0">
		<xsl:copy>
			<xsl:attribute name="xml:lang">en-us</xsl:attribute>
			<xsl:choose>
				<xsl:when test="my:section1"><xsl:apply-templates select="my:section1[1]" mode="_1"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section1"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_1"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:section2"><xsl:apply-templates select="my:section2[1]" mode="_2"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section2"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_2"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:section3"><xsl:apply-templates select="my:section3[1]" mode="_3"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section3"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_3"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:section4"><xsl:apply-templates select="my:section4[1]" mode="_4"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section4"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_4"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:section5"><xsl:apply-templates select="my:section5[1]" mode="_5"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section5"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_5"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:section6"><xsl:apply-templates select="my:section6[1]" mode="_6"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section6"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_6"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:section7"><xsl:apply-templates select="my:section7[1]" mode="_7"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section7"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_7"/></xsl:otherwise>
			</xsl:choose>
			<xsl:choose>
				<xsl:when test="my:section8"><xsl:apply-templates select="my:section8[1]" mode="_8"/></xsl:when>
				<xsl:otherwise><xsl:variable name="var"><xsl:element name="my:section8"/></xsl:variable><xsl:apply-templates select="msxsl:node-set($var)/*" mode="_8"/></xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section1" mode="_1">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:s1f01">
					<xsl:copy-of select="my:s1f01"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f01">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f02">
				<xsl:choose>
					<xsl:when test="my:s1f02"><xsl:copy-of select="my:s1f02/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f03">
					<xsl:copy-of select="my:s1f03"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f03">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f04">
				<xsl:choose>
					<xsl:when test="my:s1f04"><xsl:copy-of select="my:s1f04/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f05">
					<xsl:copy-of select="my:s1f05"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f05">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f06">
				<xsl:choose>
					<xsl:when test="my:s1f06"><xsl:copy-of select="my:s1f06/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f07">
				<xsl:choose>
					<xsl:when test="my:s1f07"><xsl:copy-of select="my:s1f07/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f08">
				<xsl:choose>
					<xsl:when test="my:s1f08"><xsl:copy-of select="my:s1f08/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f09">
				<xsl:choose>
					<xsl:when test="my:s1f09"><xsl:copy-of select="my:s1f09/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f10">
				<xsl:choose>
					<xsl:when test="my:s1f10"><xsl:copy-of select="my:s1f10/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f11">
					<xsl:copy-of select="my:s1f11"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f11">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f12">
				<xsl:choose>
					<xsl:when test="my:s1f12"><xsl:copy-of select="my:s1f12/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f13">
					<xsl:copy-of select="my:s1f13"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f13">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f14">
				<xsl:choose>
					<xsl:when test="my:s1f14"><xsl:copy-of select="my:s1f14/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f15">
					<xsl:copy-of select="my:s1f15"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f15">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f16">
				<xsl:choose>
					<xsl:when test="my:s1f16"><xsl:copy-of select="my:s1f16/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f17">
				<xsl:choose>
					<xsl:when test="my:s1f17"><xsl:copy-of select="my:s1f17/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f18">
				<xsl:choose>
					<xsl:when test="my:s1f18"><xsl:copy-of select="my:s1f18/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f19">
				<xsl:choose>
					<xsl:when test="my:s1f19"><xsl:copy-of select="my:s1f19/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s1f20">
				<xsl:choose>
					<xsl:when test="my:s1f20"><xsl:copy-of select="my:s1f20/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f21">
					<xsl:copy-of select="my:s1f21"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f21">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f22">
				<xsl:choose>
					<xsl:when test="my:s1f22"><xsl:copy-of select="my:s1f22/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f23">
					<xsl:copy-of select="my:s1f23"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f23">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s1f24">
				<xsl:choose>
					<xsl:when test="my:s1f24"><xsl:copy-of select="my:s1f24/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s1f25">
					<xsl:copy-of select="my:s1f25"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s1f25">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section2" mode="_2">
		<xsl:copy>
			<xsl:element name="my:s2f01">
				<xsl:choose>
					<xsl:when test="my:s2f01"><xsl:copy-of select="my:s2f01/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f02">
					<xsl:copy-of select="my:s2f02"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f02">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f03">
				<xsl:choose>
					<xsl:when test="my:s2f03"><xsl:copy-of select="my:s2f03/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f04">
					<xsl:copy-of select="my:s2f04"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f04">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f05">
				<xsl:choose>
					<xsl:when test="my:s2f05"><xsl:copy-of select="my:s2f05/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f06">
				<xsl:choose>
					<xsl:when test="my:s2f06"><xsl:copy-of select="my:s2f06/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f07">
				<xsl:choose>
					<xsl:when test="my:s2f07"><xsl:copy-of select="my:s2f07/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f08">
				<xsl:choose>
					<xsl:when test="my:s2f08"><xsl:copy-of select="my:s2f08/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f09">
				<xsl:choose>
					<xsl:when test="my:s2f09"><xsl:copy-of select="my:s2f09/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f10">
					<xsl:copy-of select="my:s2f10"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f10">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f11">
				<xsl:choose>
					<xsl:when test="my:s2f11"><xsl:copy-of select="my:s2f11/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f12">
					<xsl:copy-of select="my:s2f12"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f12">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f13">
				<xsl:choose>
					<xsl:when test="my:s2f13"><xsl:copy-of select="my:s2f13/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f14">
					<xsl:copy-of select="my:s2f14"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f14">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f15">
				<xsl:choose>
					<xsl:when test="my:s2f15"><xsl:copy-of select="my:s2f15/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f16">
				<xsl:choose>
					<xsl:when test="my:s2f16"><xsl:copy-of select="my:s2f16/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f17">
				<xsl:choose>
					<xsl:when test="my:s2f17"><xsl:copy-of select="my:s2f17/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f18">
				<xsl:choose>
					<xsl:when test="my:s2f18"><xsl:copy-of select="my:s2f18/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s2f19">
				<xsl:choose>
					<xsl:when test="my:s2f19"><xsl:copy-of select="my:s2f19/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f20">
					<xsl:copy-of select="my:s2f20"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f20">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f21">
				<xsl:choose>
					<xsl:when test="my:s2f21"><xsl:copy-of select="my:s2f21/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f22">
					<xsl:copy-of select="my:s2f22"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f22">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f23">
				<xsl:choose>
					<xsl:when test="my:s2f23"><xsl:copy-of select="my:s2f23/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s2f24">
					<xsl:copy-of select="my:s2f24"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s2f24">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s2f25">
				<xsl:choose>
					<xsl:when test="my:s2f25"><xsl:copy-of select="my:s2f25/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section3" mode="_3">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:s3f01">
					<xsl:copy-of select="my:s3f01"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f01">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f02">
				<xsl:choose>
					<xsl:when test="my:s3f02"><xsl:copy-of select="my:s3f02/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s3f03">
					<xsl:copy-of select="my:s3f03"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f03">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f04">
				<xsl:choose>
					<xsl:when test="my:s3f04"><xsl:copy-of select="my:s3f04/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f05">
				<xsl:choose>
					<xsl:when test="my:s3f05"><xsl:copy-of select="my:s3f05/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f06">
				<xsl:choose>
					<xsl:when test="my:s3f06"><xsl:copy-of select="my:s3f06/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f07">
				<xsl:choose>
					<xsl:when test="my:s3f07"><xsl:copy-of select="my:s3f07/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f08">
				<xsl:choose>
					<xsl:when test="my:s3f08"><xsl:copy-of select="my:s3f08/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s3f09">
					<xsl:copy-of select="my:s3f09"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f09">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f10">
				<xsl:choose>
					<xsl:when test="my:s3f10"><xsl:copy-of select="my:s3f10/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s3f11">
					<xsl:copy-of select="my:s3f11"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f11">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f12">
				<xsl:choose>
					<xsl:when test="my:s3f12"><xsl:copy-of select="my:s3f12/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s3f13">
					<xsl:copy-of select="my:s3f13"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f13">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f14">
				<xsl:choose>
					<xsl:when test="my:s3f14"><xsl:copy-of select="my:s3f14/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f15">
				<xsl:choose>
					<xsl:when test="my:s3f15"><xsl:copy-of select="my:s3f15/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f16">
				<xsl:choose>
					<xsl:when test="my:s3f16"><xsl:copy-of select="my:s3f16/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f17">
				<xsl:choose>
					<xsl:when test="my:s3f17"><xsl:copy-of select="my:s3f17/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f18">
				<xsl:choose>
					<xsl:when test="my:s3f18"><xsl:copy-of select="my:s3f18/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s3f19">
					<xsl:copy-of select="my:s3f19"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f19">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f20">
				<xsl:choose>
					<xsl:when test="my:s3f20"><xsl:copy-of select="my:s3f20/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s3f21">
					<xsl:copy-of select="my:s3f21"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f21">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f22">
				<xsl:choose>
					<xsl:when test="my:s3f22"><xsl:copy-of select="my:s3f22/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s3f23">
					<xsl:copy-of select="my:s3f23"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s3f23">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s3f24">
				<xsl:choose>
					<xsl:when test="my:s3f24"><xsl:copy-of select="my:s3f24/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s3f25">
				<xsl:choose>
					<xsl:when test="my:s3f25"><xsl:copy-of select="my:s3f25/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section4" mode="_4">
		<xsl:copy>
			<xsl:element name="my:s4f01">
				<xsl:choose>
					<xsl:when test="my:s4f01"><xsl:copy-of select="my:s4f01/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s4f02">
					<xsl:copy-of select="my:s4f02"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s4f02">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s4f03">
				<xsl:choose>
					<xsl:when test="my:s4f03"><xsl:copy-of select="my:s4f03/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f04">
				<xsl:choose>
					<xsl:when test="my:s4f04"><xsl:copy-of select="my:s4f04/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f05">
				<xsl:choose>
					<xsl:when test="my:s4f05"><xsl:copy-of select="my:s4f05/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f06">
				<xsl:choose>
					<xsl:when test="my:s4f06"><xsl:copy-of select="my:s4f06/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f07">
				<xsl:choose>
					<xsl:when test="my:s4f07"><xsl:copy-of select="my:s4f07/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s4f08">
					<xsl:copy-of select="my:s4f08"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s4f08">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s4f09">
				<xsl:choose>
					<xsl:when test="my:s4f09"><xsl:copy-of select="my:s4f09/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s4f10">
					<xsl:copy-of select="my:s4f10"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s4f10">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s4f11">
				<xsl:choose>
					<xsl:when test="my:s4f11"><xsl:copy-of select="my:s4f11/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s4f12">
					<xsl:copy-of select="my:s4f12"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s4f12">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s4f13">
				<xsl:choose>
					<xsl:when test="my:s4f13"><xsl:copy-of select="my:s4f13/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f14">
				<xsl:choose>
					<xsl:when test="my:s4f14"><xsl:copy-of select="my:s4f14/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f15">
				<xsl:choose>
					<xsl:when test="my:s4f15"><xsl:copy-of select="my:s4f15/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f16">
				<xsl:choose>
					<xsl:when test="my:s4f16"><xsl:copy-of select="my:s4f16/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f17">
				<xsl:choose>
					<xsl:when test="my:s4f17"><xsl:copy-of select="my:s4f17/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s4f18">
					<xsl:copy-of select="my:s4f18"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s4f18">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s4f19">
				<xsl:choose>
					<xsl:when test="my:s4f19"><xsl:copy-of select="my:s4f19/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s4f20">
					<xsl:copy-of select="my:s4f20"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s4f20">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s4f21">
				<xsl:choose>
					<xsl:when test="my:s4f21"><xsl:copy-of select="my:s4f21/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s4f22">
					<xsl:copy-of select="my:s4f22"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s4f22">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s4f23">
				<xsl:choose>
					<xsl:when test="my:s4f23"><xsl:copy-of select="my:s4f23/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f24">
				<xsl:choose>
					<xsl:when test="my:s4f24"><xsl:copy-of select="my:s4f24/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s4f25">
				<xsl:choose>
					<xsl:when test="my:s4f25"><xsl:copy-of select="my:s4f25/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section5" mode="_5">
		<xsl:copy>
			<xsl:choose>
				<xsl:when test="my:s5f01">
					<xsl:copy-of select="my:s5f01"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s5f01">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s5f02">
				<xsl:choose>
					<xsl:when test="my:s5f02"><xsl:copy-of select="my:s5f02/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f03">
				<xsl:choose>
					<xsl:when test="my:s5f03"><xsl:copy-of select="my:s5f03/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f04">
				<xsl:choose>
					<xsl:when test="my:s5f04"><xsl:copy-of select="my:s5f04/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f05">
				<xsl:choose>
					<xsl:when test="my:s5f05"><xsl:copy-of select="my:s5f05/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f06">
				<xsl:choose>
					<xsl:when test="my:s5f06"><xsl:copy-of select="my:s5f06/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s5f07">
					<xsl:copy-of select="my:s5f07"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s5f07">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s5f08">
				<xsl:choose>
					<xsl:when test="my:s5f08"><xsl:copy-of select="my:s5f08/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s5f09">
					<xsl:copy-of select="my:s5f09"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s5f09">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s5f10">
				<xsl:choose>
					<xsl:when test="my:s5f10"><xsl:copy-of select="my:s5f10/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s5f11">
					<xsl:copy-of select="my:s5f11"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s5f11">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s5f12">
				<xsl:choose>
					<xsl:when test="my:s5f12"><xsl:copy-of select="my:s5f12/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f13">
				<xsl:choose>
					<xsl:when test="my:s5f13"><xsl:copy-of select="my:s5f13/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f14">
				<xsl:choose>
					<xsl:when test="my:s5f14"><xsl:copy-of select="my:s5f14/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f15">
				<xsl:choose>
					<xsl:when test="my:s5f15"><xsl:copy-of select="my:s5f15/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f16">
				<xsl:choose>
					<xsl:when test="my:s5f16"><xsl:copy-of select="my:s5f16/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s5f17">
					<xsl:copy-of select="my:s5f17"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s5f17">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s5f18">
				<xsl:choose>
					<xsl:when test="my:s5f18"><xsl:copy-of select="my:s5f18/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s5f19">
					<xsl:copy-of select="my:s5f19"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s5f19">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s5f20">
				<xsl:choose>
					<xsl:when test="my:s5f20"><xsl:copy-of select="my:s5f20/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s5f21">
					<xsl:copy-of select="my:s5f21"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s5f21">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s5f22">
				<xsl:choose>
					<xsl:when test="my:s5f22"><xsl:copy-of select="my:s5f22/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f23">
				<xsl:choose>
					<xsl:when test="my:s5f23"><xsl:copy-of select="my:s5f23/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f24">
				<xsl:choose>
					<xsl:when test="my:s5f24"><xsl:copy-of select="my:s5f24/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s5f25">
				<xsl:choose>
					<xsl:when test="my:s5f25"><xsl:copy-of select="my:s5f25/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section6" mode="_6">
		<xsl:copy>
			<xsl:element name="my:s6f01">
				<xsl:choose>
					<xsl:when test="my:s6f01"><xsl:copy-of select="my:s6f01/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f02">
				<xsl:choose>
					<xsl:when test="my:s6f02"><xsl:copy-of select="my:s6f02/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f03">
				<xsl:choose>
					<xsl:when test="my:s6f03"><xsl:copy-of select="my:s6f03/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f04">
				<xsl:choose>
					<xsl:when test="my:s6f04"><xsl:copy-of select="my:s6f04/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f05">
				<xsl:choose>
					<xsl:when test="my:s6f05"><xsl:copy-of select="my:s6f05/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s6f06">
					<xsl:copy-of select="my:s6f06"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s6f06">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s6f07">
				<xsl:choose>
					<xsl:when test="my:s6f07"><xsl:copy-of select="my:s6f07/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s6f08">
					<xsl:copy-of select="my:s6f08"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s6f08">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s6f09">
				<xsl:choose>
					<xsl:when test="my:s6f09"><xsl:copy-of select="my:s6f09/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s6f10">
					<xsl:copy-of select="my:s6f10"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s6f10">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s6f11">
				<xsl:choose>
					<xsl:when test="my:s6f11"><xsl:copy-of select="my:s6f11/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f12">
				<xsl:choose>
					<xsl:when test="my:s6f12"><xsl:copy-of select="my:s6f12/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f13">
				<xsl:choose>
					<xsl:when test="my:s6f13"><xsl:copy-of select="my:s6f13/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f14">
				<xsl:choose>
					<xsl:when test="my:s6f14"><xsl:copy-of select="my:s6f14/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f15">
				<xsl:choose>
					<xsl:when test="my:s6f15"><xsl:copy-of select="my:s6f15/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s6f16">
					<xsl:copy-of select="my:s6f16"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s6f16">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s6f17">
				<xsl:choose>
					<xsl:when test="my:s6f17"><xsl:copy-of select="my:s6f17/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s6f18">
					<xsl:copy-of select="my:s6f18"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s6f18">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s6f19">
				<xsl:choose>
					<xsl:when test="my:s6f19"><xsl:copy-of select="my:s6f19/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s6f20">
					<xsl:copy-of select="my:s6f20"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s6f20">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s6f21">
				<xsl:choose>
					<xsl:when test="my:s6f21"><xsl:copy-of select="my:s6f21/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f22">
				<xsl:choose>
					<xsl:when test="my:s6f22"><xsl:copy-of select="my:s6f22/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f23">
				<xsl:choose>
					<xsl:when test="my:s6f23"><xsl:copy-of select="my:s6f23/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f24">
				<xsl:choose>
					<xsl:when test="my:s6f24"><xsl:copy-of select="my:s6f24/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s6f25">
				<xsl:choose>
					<xsl:when test="my:s6f25"><xsl:copy-of select="my:s6f25/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section7" mode="_7">
		<xsl:copy>
			<xsl:element name="my:s7f01">
				<xsl:choose>
					<xsl:when test="my:s7f01"><xsl:copy-of select="my:s7f01/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f02">
				<xsl:choose>
					<xsl:when test="my:s7f02"><xsl:copy-of select="my:s7f02/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f03">
				<xsl:choose>
					<xsl:when test="my:s7f03"><xsl:copy-of select="my:s7f03/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f04">
				<xsl:choose>
					<xsl:when test="my:s7f04"><xsl:copy-of select="my:s7f04/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s7f05">
					<xsl:copy-of select="my:s7f05"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s7f05">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s7f06">
				<xsl:choose>
					<xsl:when test="my:s7f06"><xsl:copy-of select="my:s7f06/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s7f07">
					<xsl:copy-of select="my:s7f07"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s7f07">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s7f08">
				<xsl:choose>
					<xsl:when test="my:s7f08"><xsl:copy-of select="my:s7f08/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s7f09">
					<xsl:copy-of select="my:s7f09"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s7f09">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s7f10">
				<xsl:choose>
					<xsl:when test="my:s7f10"><xsl:copy-of select="my:s7f10/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f11">
				<xsl:choose>
					<xsl:when test="my:s7f11"><xsl:copy-of select="my:s7f11/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f12">
				<xsl:choose>
					<xsl:when test="my:s7f12"><xsl:copy-of select="my:s7f12/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f13">
				<xsl:choose>
					<xsl:when test="my:s7f13"><xsl:copy-of select="my:s7f13/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f14">
				<xsl:choose>
					<xsl:when test="my:s7f14"><xsl:copy-of select="my:s7f14/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s7f15">
					<xsl:copy-of select="my:s7f15"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s7f15">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s7f16">
				<xsl:choose>
					<xsl:when test="my:s7f16"><xsl:copy-of select="my:s7f16/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s7f17">
					<xsl:copy-of select="my:s7f17"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s7f17">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s7f18">
				<xsl:choose>
					<xsl:when test="my:s7f18"><xsl:copy-of select="my:s7f18/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s7f19">
					<xsl:copy-of select="my:s7f19"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s7f19">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s7f20">
				<xsl:choose>
					<xsl:when test="my:s7f20"><xsl:copy-of select="my:s7f20/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f21">
				<xsl:choose>
					<xsl:when test="my:s7f21"><xsl:copy-of select="my:s7f21/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f22">
				<xsl:choose>
					<xsl:when test="my:s7f22"><xsl:copy-of select="my:s7f22/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f23">
				<xsl:choose>
					<xsl:when test="my:s7f23"><xsl:copy-of select="my:s7f23/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s7f24">
				<xsl:choose>
					<xsl:when test="my:s7f24"><xsl:copy-of select="my:s7f24/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s7f25">
					<xsl:copy-of select="my:s7f25"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s7f25">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:copy>
	</xsl:template>
	<xsl:template match="my:section8" mode="_8">
		<xsl:copy>
			<xsl:element name="my:s8f01">
				<xsl:choose>
					<xsl:when test="my:s8f01"><xsl:copy-of select="my:s8f01/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f02">
				<xsl:choose>
					<xsl:when test="my:s8f02"><xsl:copy-of select="my:s8f02/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f03">
				<xsl:choose>
					<xsl:when test="my:s8f03"><xsl:copy-of select="my:s8f03/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s8f04">
					<xsl:copy-of select="my:s8f04"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s8f04">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s8f05">
				<xsl:choose>
					<xsl:when test="my:s8f05"><xsl:copy-of select="my:s8f05/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s8f06">
					<xsl:copy-of select="my:s8f06"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s8f06">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s8f07">
				<xsl:choose>
					<xsl:when test="my:s8f07"><xsl:copy-of select="my:s8f07/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s8f08">
					<xsl:copy-of select="my:s8f08"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s8f08">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s8f09">
				<xsl:choose>
					<xsl:when test="my:s8f09"><xsl:copy-of select="my:s8f09/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f10">
				<xsl:choose>
					<xsl:when test="my:s8f10"><xsl:copy-of select="my:s8f10/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f11">
				<xsl:choose>
					<xsl:when test="my:s8f11"><xsl:copy-of select="my:s8f11/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f12">
				<xsl:choose>
					<xsl:when test="my:s8f12"><xsl:copy-of select="my:s8f12/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f13">
				<xsl:choose>
					<xsl:when test="my:s8f13"><xsl:copy-of select="my:s8f13/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s8f14">
					<xsl:copy-of select="my:s8f14"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s8f14">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s8f15">
				<xsl:choose>
					<xsl:when test="my:s8f15"><xsl:copy-of select="my:s8f15/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s8f16">
					<xsl:copy-of select="my:s8f16"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s8f16">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s8f17">
				<xsl:choose>
					<xsl:when test="my:s8f17"><xsl:copy-of select="my:s8f17/text()[1]"/></xsl:when>
					<xsl:otherwise>false</xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s8f18">
					<xsl:copy-of select="my:s8f18"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s8f18">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s8f19">
				<xsl:choose>
					<xsl:when test="my:s8f19"><xsl:copy-of select="my:s8f19/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f20">
				<xsl:choose>
					<xsl:when test="my:s8f20"><xsl:copy-of select="my:s8f20/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f21">
				<xsl:choose>
					<xsl:when test="my:s8f21"><xsl:copy-of select="my:s8f21/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f22">
				<xsl:choose>
					<xsl:when test="my:s8f22"><xsl:copy-of select="my:s8f22/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:element name="my:s8f23">
				<xsl:choose>
					<xsl:when test="my:s8f23"><xsl:copy-of select="my:s8f23/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
			<xsl:choose>
				<xsl:when test="my:s8f24">
					<xsl:copy-of select="my:s8f24"/>
				</xsl:when>
				<xsl:otherwise>
					<xsl:element name="my:s8f24">
						<xsl:attribute name="xsi:nil">true</xsl:attribute>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
			<xsl:element name="my:s8f25">
				<xsl:choose>
					<xsl:when test="my:s8f25"><xsl:copy-of select="my:s8f25/text()[1]"/></xsl:when>
					<xsl:otherwise></xsl:otherwise>
				</xsl:choose>
			</xsl:element>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
