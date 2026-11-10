// Path strings for elements, attributes and text (design §7.3, glossary "Path"). Each element step
// is `prefix:local[n]`, n being the 1-based position among siblings with the same namespace and
// local name. Prefixes are fixed for the known namespaces; any other namespace is `{uri}local`,
// no namespace is `local`. The document's own prefixes are never used, so renaming a prefix does
// not change a path.

export const NS = {
  xsf: 'http://schemas.microsoft.com/office/infopath/2003/solutionDefinition',
  xsf2: 'http://schemas.microsoft.com/office/infopath/2006/solutionDefinition/extensions',
  xsf3: 'http://schemas.microsoft.com/office/infopath/2009/solutionDefinition/extensions',
  xsd: 'http://www.w3.org/2001/XMLSchema',
  /** Bound to `xml` in every document (Namespaces in XML 1.0 §3). */
  xml: 'http://www.w3.org/XML/1998/namespace',
} as const;

const PREFIX_BY_URI = new Map<string, string>(Object.entries(NS).map(([p, uri]) => [uri, p]));

/** `xsf:view`, `{urn:x}item` or `item`. */
export function qualified(namespaceURI: string | null, localName: string): string {
  if (namespaceURI === null || namespaceURI === '') return localName;
  const prefix = PREFIX_BY_URI.get(namespaceURI);
  return prefix === undefined ? `{${namespaceURI}}${localName}` : `${prefix}:${localName}`;
}

export function elementStep(namespaceURI: string | null, localName: string, n: number): string {
  return `${qualified(namespaceURI, localName)}[${n}]`;
}

export function attributeStep(namespaceURI: string | null, localName: string): string {
  return `@${qualified(namespaceURI, localName)}`;
}

export function textStep(n: number): string {
  return `text()[${n}]`;
}
