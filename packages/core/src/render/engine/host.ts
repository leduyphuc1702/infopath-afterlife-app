// What extension functions see of the engine (spec 03 design §7.1). Bindings in
// render/functions.ts are written against these types only, so they do not depend on xsltjs.

import type { Issue } from '../../errors';

/** One argument expression, evaluated at most once, when first asked. */
export interface FnArg {
  string(): string;
  number(): number;
}

export interface FnHost {
  /** Records an issue for this render; the caller keeps one per kind. */
  report(issue: Issue): void;
}

export type FnValue = string | number | boolean;
export type FnImpl = (args: readonly FnArg[], host: FnHost) => FnValue;

/** Namespace URI → local name → implementation. */
export type FunctionTable = ReadonlyMap<string, ReadonlyMap<string, FnImpl>>;

/** The 27 XPath 1.0 core functions and the 9 XSLT 1.0 functions (design §7.2). */
export const CORE_FUNCTIONS: ReadonlySet<string> = new Set([
  'last',
  'position',
  'count',
  'id',
  'local-name',
  'namespace-uri',
  'name',
  'string',
  'concat',
  'starts-with',
  'contains',
  'substring-before',
  'substring-after',
  'substring',
  'string-length',
  'normalize-space',
  'translate',
  'boolean',
  'not',
  'true',
  'false',
  'lang',
  'number',
  'sum',
  'floor',
  'ceiling',
  'round',
  'document',
  'key',
  'format-number',
  'current',
  'unparsed-entity-uri',
  'generate-id',
  'system-property',
  'element-available',
  'function-available',
]);

/** Core functions whose string result is charged to the budget (design §6). */
export const STRING_FUNCTIONS: ReadonlySet<string> = new Set([
  'concat',
  'substring',
  'substring-before',
  'substring-after',
  'translate',
  'normalize-space',
  'string',
]);

/** Prefixes for issue text, as InfoPath writes them; other namespaces print as `{uri}local`. */
export const KNOWN_PREFIXES: ReadonlyMap<string, string> = new Map([
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/formatting', 'xdFormatting'],
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument', 'xdXDocument'],
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/xImage', 'xdImage'],
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/Date', 'xdDate'],
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/Math', 'xdMath'],
  ['http://schemas.microsoft.com/office/infopath/2006/xslt/User', 'xdUser'],
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/Util', 'xdUtil'],
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/extension', 'xdExtension'],
  ['http://schemas.microsoft.com/office/infopath/2003/xslt/solution', 'xdSolution'],
  ['http://schemas.microsoft.com/office/infopath/2006/xslt/environment', 'xdEnvironment'],
  ['http://schemas.microsoft.com/office/infopath/2009/xslt/ServerInfo', 'xdServerInfo'],
  ['http://schemas.microsoft.com/office/infopath/2006/XPathExtension/ipApp', 'ipApp'],
  ['urn:schemas-microsoft-com:xslt', 'msxsl'],
]);

export function functionName(local: string, ns: string): string {
  if (ns === '') return local;
  const prefix = KNOWN_PREFIXES.get(ns);
  return prefix === undefined ? `{${ns}}${local}` : `${prefix}:${local}`;
}
