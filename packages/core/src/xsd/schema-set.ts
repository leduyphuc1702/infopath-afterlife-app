// The schema set (design §9.1, D9): every `.xsd` package file is parsed and walked for unknown
// content; globals are indexed in one table per schema root (the main schema and each
// `dataObject/@schema`), holding the root file and the files it reaches through `include` and
// `import`. Nothing is fetched: a URL or absolute `schemaLocation` is UNRESOLVED_REFERENCE (R15.2).

import { AfterlifeError, type Issue, type IssueCode } from '../errors';
import type { UnknownEntry } from '../unknown';
import { parseXml, type XmlContext } from '../xml/parse';
import { NS } from '../xml/path';
import type { Manifest } from '../xsf/types';
import { walkTree, type ModelNode } from '../xsf/walk';
import { XSD_DOCUMENTATION, XSD_VOCABULARY } from './vocabulary';

export interface SchemaFileInput {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface SchemaDoc {
  readonly file: string;
  readonly root: ModelNode;
  /** `targetNamespace`, or null when absent or empty. */
  readonly targetNamespace: string | null;
}

/** XSD symbol spaces: types are one space for complex and simple types. */
export type GlobalKind = 'element' | 'type' | 'attribute' | 'group' | 'attributeGroup';

export interface Global {
  readonly kind: GlobalKind;
  readonly namespace: string | null;
  readonly name: string;
  readonly node: ModelNode;
  readonly doc: SchemaDoc;
}

export interface QName {
  readonly namespace: string | null;
  readonly local: string;
}

const KIND_OF: Readonly<Record<string, GlobalKind>> = {
  'xsd:element': 'element',
  'xsd:complexType': 'type',
  'xsd:simpleType': 'type',
  'xsd:attribute': 'attribute',
  'xsd:group': 'group',
  'xsd:attributeGroup': 'attributeGroup',
};

const keyOf = (ns: string | null, local: string) => `{${ns ?? ''}}${local}`;

/** The globals reachable from one schema root (R15.7). */
export class SchemaTable {
  private readonly globals = new Map<string, Global>();
  /** Effective target namespace of each file in this table (chameleon includes adopt the includer's). */
  private readonly effective = new Map<SchemaDoc, string | null>();
  /** Files in reach order: the root first, then depth first in directive order. */
  readonly files: SchemaDoc[] = [];

  constructor(readonly root: SchemaDoc) {}

  add(doc: SchemaDoc, ns: string | null): boolean {
    if (this.effective.has(doc)) return false;
    this.effective.set(doc, ns);
    this.files.push(doc);
    return true;
  }

  /** Indexes the globals of every file; a repeat keeps the first and is returned. */
  index(): { first: Global; second: Global }[] {
    const repeats: { first: Global; second: Global }[] = [];
    for (const doc of this.files) {
      const ns = this.effective.get(doc)!;
      for (const c of doc.root.children) {
        const kind = KIND_OF[c.key];
        const name = c.attrs.name;
        if (!kind || name === undefined) continue;
        const g: Global = { kind, namespace: ns, name, node: c, doc };
        const k = `${kind} ${keyOf(ns, name)}`;
        const first = this.globals.get(k);
        if (first) repeats.push({ first, second: g });
        else this.globals.set(k, g);
      }
    }
    return repeats;
  }

  get(kind: GlobalKind, name: QName): Global | undefined {
    return this.globals.get(`${kind} ${keyOf(name.namespace, name.local)}`);
  }

  /** The first global element of the root file. */
  firstElement(): Global | undefined {
    const c = this.root.root.children.find((n) => n.key === 'xsd:element' && n.attrs.name);
    return (
      c && this.get('element', { namespace: this.namespaceOf(this.root), local: c.attrs.name! })
    );
  }

  namespaceOf(doc: SchemaDoc): string | null {
    return this.effective.get(doc) ?? doc.targetNamespace;
  }

  /**
   * Resolves a QName attribute value written on `node` (of `doc`): `p:local` through the prefixes
   * in scope, `local` through the default namespace. An unprefixed name with no default namespace
   * in a chameleon-included file takes the includer's namespace. Undefined when the prefix is
   * unbound.
   */
  qname(node: ModelNode, doc: SchemaDoc, value: string): QName | undefined {
    const v = value.trim();
    const colon = v.indexOf(':');
    if (colon >= 0) {
      const ns = node.element.lookupNamespace(v.slice(0, colon));
      return ns === null ? undefined : { namespace: ns, local: v.slice(colon + 1) };
    }
    const ns = node.element.lookupNamespace(null);
    if (ns === null && doc.targetNamespace === null) {
      return { namespace: this.effective.get(doc) ?? null, local: v };
    }
    return { namespace: ns, local: v };
  }
}

export interface SchemaRoot {
  readonly file: string;
  readonly table: SchemaTable;
  /** The root element declaration; absent when it cannot be found (issue recorded). */
  readonly element?: Global;
}

export interface SchemaSet {
  /** Every schema that parsed, by file name. */
  readonly docs: readonly SchemaDoc[];
  readonly main?: SchemaRoot;
  /** Key: `dataObject/@name` (R11.6). */
  readonly secondary: Readonly<Record<string, SchemaRoot>>;
  /** Schema files by name, document order within a file. */
  readonly unknowns: readonly UnknownEntry[];
  readonly issues: readonly Issue[];
}

const NON_FATAL: ReadonlySet<IssueCode> = new Set(['INVALID_XML', 'UNSAFE_XML', 'LIMIT_EXCEEDED']);

function byName(a: { name: string }, b: { name: string }): number {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** Where a `schemaLocation` points: a package file name, or why it is not one. */
export function classifyLocation(
  location: string,
): { kind: 'file'; name: string } | { kind: 'remote' | 'absolute' } {
  const l = location.trim();
  if (/^[a-z]:/i.test(l) || /^[\\/]/.test(l)) return { kind: 'absolute' };
  if (/^[a-z][a-z0-9+.-]+:/i.test(l)) return { kind: 'remote' };
  const parts = l.split(/[\\/]/);
  return { kind: 'file', name: parts[parts.length - 1]! };
}

export function loadSchemaSet(
  files: readonly SchemaFileInput[],
  manifest: Manifest,
  ctx: XmlContext,
): SchemaSet {
  const issues: Issue[] = [];
  const unknowns: UnknownEntry[] = [];
  const docs: SchemaDoc[] = [];

  for (const f of [...files].filter((x) => /\.xsd$/i.test(x.name)).sort(byName)) {
    try {
      const xml = parseXml(f.bytes, f.name, ctx);
      issues.push(...xml.issues);
      const walked = walkTree(xml.root, f.name, {
        vocabulary: XSD_VOCABULARY,
        rootKey: 'xsd:schema',
        documentation: XSD_DOCUMENTATION,
        notRoot: 'not an XML Schema: the root is not xsd:schema',
      });
      unknowns.push(...walked.unknowns);
      const tns = walked.root.attrs.targetNamespace;
      docs.push({ file: f.name, root: walked.root, targetNamespace: tns ? tns : null });
    } catch (e) {
      if (!(e instanceof AfterlifeError) || !NON_FATAL.has(e.code as IssueCode)) throw e;
      issues.push({
        code: e.code as IssueCode,
        message: e.message,
        file: f.name,
        details: Object.fromEntries(
          Object.entries(e.details as Record<string, unknown>).filter(
            (kv): kv is [string, string | number] =>
              typeof kv[1] === 'string' || typeof kv[1] === 'number',
          ),
        ),
        ...lineOf(e.details),
      });
    }
  }

  const byFile = new Map(docs.map((d) => [d.file.toLowerCase(), d]));
  const edges = resolveDirectives(docs, byFile, issues);

  const roots = new Map<string, SchemaRoot>();
  const reported = new Set<string>();
  const rootFor = (file: string, elementName: string | undefined): SchemaRoot | undefined => {
    const doc = byFile.get(file.toLowerCase());
    if (!doc) return undefined; // missing or unreadable: reported by the package checks or above
    const table = new SchemaTable(doc);
    const visit = (d: SchemaDoc, ns: string | null) => {
      if (!table.add(d, ns)) return;
      for (const edge of edges.get(d) ?? []) {
        visit(
          edge.target,
          edge.include ? (edge.target.targetNamespace ?? ns) : edge.target.targetNamespace,
        );
      }
    };
    visit(doc, doc.targetNamespace);
    for (const { first, second } of table.index()) {
      const id = `${second.node.path}@${second.doc.file}|${first.node.path}@${first.doc.file}`;
      if (reported.has(id)) continue;
      reported.add(id);
      const name = `${keyOf(first.namespace, first.name)}`;
      issues.push({
        code: 'DUPLICATE_GLOBAL',
        message: `${second.doc.file}: global ${first.kind} ${name} at ${second.node.path} repeats ${first.doc.file} ${first.node.path}; the first is used`,
        file: second.doc.file,
        path: second.node.path,
        line: second.node.line,
        column: second.node.column,
        details: {
          kind: first.kind,
          name,
          file: second.doc.file,
          path: second.node.path,
          otherFile: first.doc.file,
          otherPath: first.node.path,
          root: doc.file,
        },
      });
    }
    let element: Global | undefined;
    if (elementName !== undefined) {
      element = table.get('element', { namespace: table.namespaceOf(doc), local: elementName });
    } else {
      element = table.firstElement();
    }
    if (!element) {
      issues.push({
        code: 'UNRESOLVED_REFERENCE',
        message: `${doc.file}: no root element ${elementName ?? '(no global element)'}`,
        file: doc.file,
        path: doc.root.path,
        details: { reference: elementName ?? '', kind: 'rootElement' },
      });
    }
    return { file: doc.file, table, ...(element ? { element } : {}) };
  };

  let main: SchemaRoot | undefined;
  const mainSchema = manifest.documentSchemas.find((s) => s.attrs.rootSchema === 'yes');
  const mainLocation = mainSchema?.attrs.location?.trim().split(/\s+/).pop();
  if (mainLocation) {
    const entry = manifest.package.find(
      (p) => p.attrs.name?.toLowerCase() === mainLocation.toLowerCase(),
    );
    const rootElement = entry?.properties.find((p) => p.attrs.name === 'rootElement')?.attrs.value;
    main = rootFor(mainLocation, rootElement);
    if (main) roots.set(mainLocation.toLowerCase(), main);
  }
  const secondary: Record<string, SchemaRoot> = {};
  for (const d of manifest.dataObjects) {
    const name = d.attrs.name;
    const schema = d.attrs.schema;
    if (name === undefined || schema === undefined) continue;
    const root = rootFor(schema, undefined);
    if (root) secondary[name] = root;
  }

  return { docs, ...(main ? { main } : {}), secondary, unknowns, issues };
}

interface Edge {
  readonly target: SchemaDoc;
  readonly include: boolean;
}

/** Resolves every include and import once per file; unresolvable ones are issues. */
function resolveDirectives(
  docs: readonly SchemaDoc[],
  byFile: ReadonlyMap<string, SchemaDoc>,
  issues: Issue[],
): Map<SchemaDoc, Edge[]> {
  const edges = new Map<SchemaDoc, Edge[]>();
  for (const doc of docs) {
    const out: Edge[] = [];
    for (const d of doc.root.children) {
      if (d.key !== 'xsd:include' && d.key !== 'xsd:import') continue;
      const include = d.key === 'xsd:include';
      const location = d.attrs.schemaLocation;
      let target: SchemaDoc | undefined;
      let failure: string | undefined;
      if (location === undefined) {
        if (include) failure = 'no schemaLocation';
        else {
          // import by namespace: the one loaded file with that target namespace (design §9.1).
          const ns = d.attrs.namespace || null;
          const matches = docs.filter((x) => x !== doc && x.targetNamespace === ns);
          if (matches.length === 1) target = matches[0];
        }
      } else {
        const where = classifyLocation(location);
        if (where.kind === 'file') {
          target = byFile.get(where.name.toLowerCase());
          if (!target) failure = 'notInPackage';
        } else failure = where.kind;
      }
      if (target && target !== doc) out.push({ target, include });
      if (failure) {
        issues.push({
          code: 'UNRESOLVED_REFERENCE',
          message: `${doc.file}: ${include ? 'include' : 'import'} ${location ?? ''} not resolved (${failure}); nothing is fetched`,
          file: doc.file,
          path: d.path,
          line: d.line,
          column: d.column,
          details: {
            reference: location ?? '',
            kind: include ? 'include' : 'import',
            reason: failure,
          },
        });
      }
    }
    edges.set(doc, out);
  }
  return edges;
}

function lineOf(details: unknown): { line?: number; column?: number } {
  const d = details as { line?: unknown; column?: unknown };
  return {
    ...(typeof d.line === 'number' ? { line: d.line } : {}),
    ...(typeof d.column === 'number' ? { column: d.column } : {}),
  };
}

/** The XML Schema namespace, for callers resolving built-in types. */
export const XSD_NS = NS.xsd;
