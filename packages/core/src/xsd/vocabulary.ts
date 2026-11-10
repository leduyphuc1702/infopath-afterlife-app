// The XSD constructs the parser models (design §9.1, R15.4), as a vocabulary table for the generic
// walker, and the XML Schema 1.0 names that supply `documented` for unknown schema entries.
//
// Keys are qualified names (`xsd:element`), not positions: XSD reuses an element name in many
// places, and the table lists, per name, the union of the children and attributes XML Schema 1.0
// allows for it in any context. Every attribute value is kept as a string (accepted at task 17):
// no `unexpectedValue` entries come from schemas.

import type { AttrSpec, ElementSpec, Vocabulary } from '../xsf/vocabulary';
import type { XmlElement } from '../xml/node';
import { NS, qualified } from '../xml/path';
import type { Documentation } from '../xsf/walk';

export const FACETS = [
  'enumeration',
  'pattern',
  'length',
  'minLength',
  'maxLength',
  'minInclusive',
  'maxInclusive',
  'minExclusive',
  'maxExclusive',
  'totalDigits',
  'fractionDigits',
  'whiteSpace',
] as const;
export type Facet = (typeof FACETS)[number];

const XML_LANG = `{${NS.xml}}lang`;

/** XML Schema 1.0 Part 1, per element: allowed children and attributes (any context). */
interface Xsd10 {
  readonly children: readonly string[];
  readonly attrs: readonly string[];
}

const PARTICLES = ['element', 'group', 'choice', 'sequence', 'any'];
const ATTR_DECLS = ['attribute', 'attributeGroup', 'anyAttribute'];
const MODEL = ['group', 'all', 'choice', 'sequence'];

const XSD_1_0: Readonly<Record<string, Xsd10>> = {
  schema: {
    children: [
      'include',
      'import',
      'redefine',
      'annotation',
      'simpleType',
      'complexType',
      'group',
      'attributeGroup',
      'element',
      'attribute',
      'notation',
    ],
    attrs: [
      'attributeFormDefault',
      'blockDefault',
      'elementFormDefault',
      'finalDefault',
      'id',
      'targetNamespace',
      'version',
      XML_LANG,
    ],
  },
  include: { children: ['annotation'], attrs: ['id', 'schemaLocation'] },
  import: { children: ['annotation'], attrs: ['id', 'namespace', 'schemaLocation'] },
  redefine: {
    children: ['annotation', 'simpleType', 'complexType', 'group', 'attributeGroup'],
    attrs: ['id', 'schemaLocation'],
  },
  element: {
    children: ['annotation', 'simpleType', 'complexType', 'unique', 'key', 'keyref'],
    attrs: [
      'abstract',
      'block',
      'default',
      'final',
      'fixed',
      'form',
      'id',
      'maxOccurs',
      'minOccurs',
      'name',
      'nillable',
      'ref',
      'substitutionGroup',
      'type',
    ],
  },
  attribute: {
    children: ['annotation', 'simpleType'],
    attrs: ['default', 'fixed', 'form', 'id', 'name', 'ref', 'type', 'use'],
  },
  complexType: {
    children: ['annotation', 'simpleContent', 'complexContent', ...MODEL, ...ATTR_DECLS],
    attrs: ['abstract', 'block', 'final', 'id', 'mixed', 'name'],
  },
  simpleType: {
    children: ['annotation', 'restriction', 'list', 'union'],
    attrs: ['final', 'id', 'name'],
  },
  sequence: { children: ['annotation', ...PARTICLES], attrs: ['id', 'maxOccurs', 'minOccurs'] },
  choice: { children: ['annotation', ...PARTICLES], attrs: ['id', 'maxOccurs', 'minOccurs'] },
  all: { children: ['annotation', 'element'], attrs: ['id', 'maxOccurs', 'minOccurs'] },
  any: {
    children: ['annotation'],
    attrs: ['id', 'maxOccurs', 'minOccurs', 'namespace', 'processContents'],
  },
  anyAttribute: { children: ['annotation'], attrs: ['id', 'namespace', 'processContents'] },
  simpleContent: { children: ['annotation', 'restriction', 'extension'], attrs: ['id'] },
  complexContent: { children: ['annotation', 'restriction', 'extension'], attrs: ['id', 'mixed'] },
  extension: { children: ['annotation', ...MODEL, ...ATTR_DECLS], attrs: ['base', 'id'] },
  restriction: {
    children: ['annotation', 'simpleType', ...FACETS, ...MODEL, ...ATTR_DECLS],
    attrs: ['base', 'id'],
  },
  group: {
    children: ['annotation', 'all', 'choice', 'sequence'],
    attrs: ['id', 'maxOccurs', 'minOccurs', 'name', 'ref'],
  },
  attributeGroup: { children: ['annotation', ...ATTR_DECLS], attrs: ['id', 'name', 'ref'] },
  list: { children: ['annotation', 'simpleType'], attrs: ['id', 'itemType'] },
  union: { children: ['annotation', 'simpleType'], attrs: ['id', 'memberTypes'] },
  unique: { children: ['annotation', 'selector', 'field'], attrs: ['id', 'name'] },
  key: { children: ['annotation', 'selector', 'field'], attrs: ['id', 'name'] },
  keyref: { children: ['annotation', 'selector', 'field'], attrs: ['id', 'name', 'refer'] },
  selector: { children: ['annotation'], attrs: ['id', 'xpath'] },
  field: { children: ['annotation'], attrs: ['id', 'xpath'] },
  notation: { children: ['annotation'], attrs: ['id', 'name', 'public', 'system'] },
  annotation: { children: ['appinfo', 'documentation'], attrs: ['id'] },
  appinfo: { children: [], attrs: ['source'] },
  documentation: { children: [], attrs: ['source', XML_LANG] },
  ...Object.fromEntries(
    FACETS.map((f) => [f, { children: ['annotation'], attrs: ['fixed', 'id', 'value'] }]),
  ),
};

/** Constructs XML Schema 1.0 defines but the parser does not model (R15.4): unknown, documented. */
const NOT_MODELLED_ELEMENTS = new Set([
  'redefine',
  'notation',
  'unique',
  'key',
  'keyref',
  'selector',
  'field',
]);
const NOT_MODELLED_ATTRS = new Set([
  'substitutionGroup',
  'abstract',
  'block',
  'final',
  'blockDefault',
  'finalDefault',
]);

/**
 * SharePoint's metaAttributes namespace (`ma:`), written on element declarations of list and
 * workflow data sources (R21.5). XSD 1.0 admits foreign attributes on every component.
 */
export const SHAREPOINT_META_NS =
  'http://schemas.microsoft.com/office/2009/metadata/properties/metaAttributes';

/** The `ma:` names modelled on `xsd:element` (R21.5); any other stays unknown. */
export const SHAREPOINT_ATTRS = [
  'readOnly',
  'displayName',
  'allowDeletion',
  'formatCategory',
  'formatSpec',
  'SearchPeopleOnly',
  'SharePointGroup',
  'auxDataSourceName',
  'auxChoicesXPath',
  'auxValue',
  'auxDisplay',
] as const;
export type SharePointAttr = (typeof SHAREPOINT_ATTRS)[number];

function spec(local: string): ElementSpec {
  const x = XSD_1_0[local]!;
  const rawXml = local === 'documentation' || local === 'appinfo';
  const attrs: [string, AttrSpec][] = x.attrs
    .filter((a) => !NOT_MODELLED_ATTRS.has(a))
    .map((a) => [a, 'string']);
  if (local === 'element') {
    for (const n of SHAREPOINT_ATTRS)
      attrs.push([`{${SHAREPOINT_META_NS}}${n}`, { viaWildcard: true }]);
  }
  return {
    attrs: Object.fromEntries(attrs),
    children: Object.fromEntries(
      x.children.filter((c) => !NOT_MODELLED_ELEMENTS.has(c)).map((c) => [`xsd:${c}`, `xsd:${c}`]),
    ),
    content: rawXml ? 'rawXml' : 'elements',
    req: 'R15.4',
  };
}

/** The modelled XSD constructs (design §9.1). */
export const XSD_VOCABULARY: Vocabulary = Object.fromEntries(
  Object.keys(XSD_1_0)
    .filter((local) => !NOT_MODELLED_ELEMENTS.has(local))
    .map((local) => [`xsd:${local}`, spec(local)]),
);

/** `documented` for schema files: XML Schema 1.0 defines the node there (R15.4). */
export const XSD_DOCUMENTATION: Documentation = {
  attr: (key, name) => XSD_1_0[key.slice('xsd:'.length)]?.attrs.includes(name) ?? false,
  child: (parentKey, child: XmlElement) => {
    if (child.namespaceURI !== NS.xsd) return false;
    const parent = XSD_1_0[parentKey.slice('xsd:'.length)];
    return parent?.children.includes(child.localName) ?? false;
  },
};

/** `xsd:schema`, for checks outside this module. */
export function isXsd(el: XmlElement, local: string): boolean {
  return qualified(el.namespaceURI, el.localName) === `xsd:${local}`;
}
