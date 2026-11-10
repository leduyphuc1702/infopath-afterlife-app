// The only importer of @xmldom/xmldom (R5.5), and parseXml: decode → charge xmlBytes → prescan →
// parse (design §7.2 steps 1–4). Every problem is thrown as an AfterlifeError; whether that is
// fatal (the manifest) or an issue (any other file) is the caller's decision (step 5, R5.4).

import { DOMParser, ParseError, XMLSerializer } from '@xmldom/xmldom';
import { AfterlifeError, type Issue } from '../errors';
import type { Limits } from '../limits';
import { decode } from './decode';
import { buildTree, type DomNode, type XmlElement } from './node';
import { prescan } from './prescan';

export interface XmlContext {
  readonly limits: Limits;
  /** XML bytes charged so far, shared by every document of one package (D7). */
  xmlBytesUsed: number;
}

export function xmlContext(limits: Limits): XmlContext {
  return { limits, xmlBytesUsed: 0 };
}

export interface ParsedXml {
  readonly root: XmlElement;
  /** Canonical name of the encoding used. */
  readonly encoding: string;
  /** Non-fatal: `INVALID_ENCODING`, `XML_WARNING`. */
  readonly issues: readonly Issue[];
}

interface Located {
  readonly lineNumber?: number;
  readonly columnNumber?: number;
}

export function parseXml(bytes: Uint8Array, file: string, ctx: XmlContext): ParsedXml {
  const decoded = decode(bytes, file);

  const observed = ctx.xmlBytesUsed + bytes.length;
  if (observed > ctx.limits.xmlBytes) {
    throw new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'xmlBytes',
      max: ctx.limits.xmlBytes,
      observed,
      file,
    });
  }
  ctx.xmlBytesUsed = observed;

  prescan(decoded.text, file, ctx.limits.xmlDepth);

  const issues: Issue[] = [...decoded.issues];
  const errors: { line: number; column: number }[] = [];
  const parser = new DOMParser({
    onError: (level, message, handler: { locator?: Located }) => {
      const { line, column } = at(handler.locator);
      if (level === 'warning') {
        issues.push({ code: 'XML_WARNING', message: `${file}: ${message}`, file, line, column });
      } else if (level === 'error') {
        errors.push({ line, column });
      }
      // 'fatalError' is thrown by the parser as a ParseError; handled below.
    },
  });

  let doc: { documentElement: unknown };
  try {
    doc = parser.parseFromString(decoded.text, 'text/xml');
  } catch (e) {
    const where = at(e instanceof ParseError ? (e.locator as Located | undefined) : undefined);
    throw new AfterlifeError('INVALID_XML', { file, ...where });
  }
  const firstError = errors[0];
  if (firstError) throw new AfterlifeError('INVALID_XML', { file, ...firstError });
  const root = doc.documentElement as DomNode | null;
  if (!root) throw new AfterlifeError('INVALID_XML', { file, line: 1, column: 1 });

  const serializer = new XMLSerializer();
  const serialize = (node: DomNode) => serializer.serializeToString(node as never);
  return { root: buildTree(root, serialize), encoding: decoded.encoding, issues };
}

/** xmldom reports line 0 when it has no position (e.g. an empty document). */
function at(locator: Located | undefined): { line: number; column: number } {
  return {
    line: Math.max(1, locator?.lineNumber ?? 1),
    column: Math.max(1, locator?.columnNumber ?? 1),
  };
}
