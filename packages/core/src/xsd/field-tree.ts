// Field tree builder (design §9.2, R14, R15.1, R15.3). Walks from a schema root's element through
// its table (§9.1): refs, named types through extension and restriction, model groups expanded in
// place, attribute groups, lists and unions. Cardinality is kept raw and made effective by
// multiplying the enclosing particles; the kind comes from the content model only.

import type { Issue } from '../errors';
import type { Located } from '../unknown';
import { NS, qualified } from '../xml/path';
import type { XmlElement } from '../xml/node';
import type { ModelNode } from '../xsf/walk';
import type { Global, GlobalKind, QName, SchemaDoc, SchemaRoot, SchemaTable } from './schema-set';
import type { Facet, FieldNode, FieldTree, GroupStep, TypeName, Wildcard } from './types';
import { FACETS, type Facet as FacetName } from './vocabulary';
import { acceptsEmpty, type SimpleTypeInfo } from './empty-string';

const XHTML = 'http://www.w3.org/1999/xhtml';
const ANY_TYPE = 'xsd:anyType';
const ANY_SIMPLE = 'xsd:anySimpleType';

/** `{min, max}` with Infinity for unbounded. */
interface Occurs {
  readonly min: number;
  readonly max: number;
}

interface SimpleInfo {
  readonly builtin: TypeName;
  readonly variety: 'atomic' | 'list' | 'union';
  readonly itemType?: TypeName;
  readonly memberTypes?: readonly TypeName[];
  readonly facets: readonly Facet[];
  /** Union only: each member type's own info, for the empty-string check (§9.3). */
  readonly members?: readonly SimpleInfo[];
}

interface Content {
  readonly kind: FieldNode['kind'];
  readonly variety: FieldNode['xsdType']['variety'];
  readonly builtin: TypeName;
  readonly itemType?: TypeName;
  readonly memberTypes?: readonly TypeName[];
  readonly facets: readonly Facet[];
  readonly members?: readonly SimpleInfo[];
  readonly elements: readonly FieldNode[];
  readonly attributes: readonly FieldNode[];
  readonly wildcards: readonly Wildcard[];
  /** A model group or attribute group referred back to itself inside this content. */
  readonly recursive: boolean;
  /** `{ns}name` of the `use="prohibited"` attributes directly in this holder (R14 note, §9.2). */
  readonly prohibited: ReadonlySet<string>;
}

interface Particle {
  readonly steps: readonly GroupStep[];
  readonly occurs: Occurs;
  readonly choiceGroup?: string;
}

export function buildFieldTree(root: SchemaRoot, issues: Issue[]): FieldTree | undefined {
  if (!root.element) return undefined;
  const b = new Builder(root.table, issues);
  const g = root.element;
  return {
    file: root.file,
    root: b.element(g.node, g.doc, { steps: [], occurs: { min: 1, max: 1 } }, []),
  };
}

class Builder {
  private choices = 0;

  constructor(
    private readonly table: SchemaTable,
    private readonly issues: Issue[],
  ) {}

  // ---- references -----------------------------------------------------------------------------

  private name(q: QName): TypeName {
    return qualified(q.namespace, q.local);
  }

  private resolve(
    kind: GlobalKind,
    site: ModelNode,
    doc: SchemaDoc,
    value: string,
  ): Global | undefined {
    const q = this.table.qname(site, doc, value);
    const g = q && this.table.get(kind, q);
    if (!g) this.unresolved(kind, site, doc, value);
    return g;
  }

  private unresolved(kind: string, site: ModelNode, doc: SchemaDoc, value: string): void {
    this.issues.push({
      code: 'UNRESOLVED_REFERENCE',
      message: `${doc.file}: ${kind} ${value} at ${site.path} is not declared in the schemas this root reaches`,
      file: doc.file,
      path: site.path,
      line: site.line,
      column: site.column,
      details: { reference: value, kind },
    });
  }

  // ---- elements -------------------------------------------------------------------------------

  /** An element node from a local declaration or a `ref` site. */
  element(
    site: ModelNode,
    doc: SchemaDoc,
    particle: Particle,
    stack: readonly string[],
  ): FieldNode {
    let decl = site;
    let declDoc = doc;
    let namespace: string | null;
    const ref = site.attrs.ref;
    if (ref !== undefined) {
      const g = this.resolve('element', site, doc, ref);
      const q = this.table.qname(site, doc, ref);
      if (!g)
        return this.unresolvedElement(site, doc, particle, q ?? { namespace: null, local: ref });
      decl = g.node;
      declDoc = g.doc;
      namespace = g.namespace;
    } else if (decl.attrs.name !== undefined && isGlobal(decl)) {
      namespace = this.table.namespaceOf(doc);
    } else {
      const form = decl.attrs.form ?? schemaAttr(doc, 'elementFormDefault') ?? 'unqualified';
      namespace = form === 'qualified' ? this.table.namespaceOf(doc) : null;
    }

    const id = `element ${declDoc.file} ${decl.path}`;
    const base = this.elementBase(site, decl, doc, declDoc, namespace, particle);
    if (stack.includes(id)) return this.leaf(base, decl, declDoc, true);

    const inner = [...stack, id];
    const typeAttr = decl.attrs.type;
    let declared: TypeName | undefined;
    let content: Content;
    const inlineComplex = decl.children.find((c) => c.key === 'xsd:complexType');
    const inlineSimple = decl.children.find((c) => c.key === 'xsd:simpleType');
    if (typeAttr !== undefined) {
      const q = this.table.qname(decl, declDoc, typeAttr);
      declared = q ? this.name(q) : typeAttr;
      content = this.typeContent(decl, declDoc, typeAttr, inner);
    } else if (inlineComplex) {
      content = this.complex(inlineComplex, declDoc, inner);
    } else if (inlineSimple) {
      content = simpleContent(this.simple(inlineSimple, declDoc, new Set()));
    } else {
      content = emptyComplex(ANY_TYPE);
    }
    const required =
      content.kind === 'field' &&
      base.effective.minOccurs >= 1 &&
      !base.effective.nillable &&
      content.variety !== 'complex' &&
      this.rejectsEmpty({ ...content, variety: content.variety }, base.source);
    return {
      ...base,
      required,
      kind: content.kind,
      xsdType: {
        ...(declared === undefined ? {} : { declared }),
        builtin: content.builtin,
        variety: content.variety,
        ...(content.itemType === undefined ? {} : { itemType: content.itemType }),
        ...(content.memberTypes === undefined ? {} : { memberTypes: content.memberTypes }),
      },
      facets: content.facets,
      wildcards: content.wildcards,
      recursive: content.recursive,
      children: [...content.elements, ...content.attributes],
    };
  }

  /**
   * R14.4: true when the type certainly rejects ''. A pattern in XML Schema syntax with no
   * JavaScript equivalent makes the answer unknown: not required, plus one PATTERN_NOT_EVALUATED
   * issue per pattern facet (a named type used many times is reported once).
   */
  private rejectsEmpty(info: SimpleInfo, node: Located): boolean {
    const r = acceptsEmpty(toSimpleType(info));
    if (r.accepts !== 'unknown') return !r.accepts;
    for (const p of r.unevaluated) {
      if (this.reportedPatterns.has(p.step)) continue;
      this.reportedPatterns.add(p.step);
      const [file, path] = splitStep(p.step);
      this.issues.push({
        code: 'PATTERN_NOT_EVALUATED',
        message: `${file}: pattern ${p.pattern} at ${path} uses XML Schema regular-expression syntax with no JavaScript equivalent; required is left false for ${node.path}`,
        file,
        path,
        details: { pattern: p.pattern, node: node.path },
      });
    }
    return false;
  }

  private readonly reportedPatterns = new Set<string>();

  private elementBase(
    site: ModelNode,
    decl: ModelNode,
    doc: SchemaDoc,
    declDoc: SchemaDoc,
    namespace: string | null,
    particle: Particle,
  ) {
    const minRaw = site.attrs.minOccurs;
    const maxRaw = site.attrs.maxOccurs;
    const nillableRaw = decl.attrs.nillable;
    const min = particle.occurs.min * occursOf(minRaw);
    const max = particle.occurs.max * occursOf(maxRaw);
    const description = describe(decl);
    return {
      name: decl.attrs.name ?? '',
      namespace,
      nodeType: 'element' as const,
      raw: {
        ...(minRaw === undefined ? {} : { minOccurs: minRaw }),
        ...(maxRaw === undefined ? {} : { maxOccurs: maxRaw }),
        ...(nillableRaw === undefined ? {} : { nillable: nillableRaw }),
        groups: particle.steps,
      },
      effective: {
        minOccurs: min,
        maxOccurs: max === Infinity ? ('unbounded' as const) : max,
        nillable: isTrue(nillableRaw),
      },
      repeating: max > 1,
      optional: min === 0,
      required: false,
      ...(particle.choiceGroup === undefined ? {} : { choiceGroup: particle.choiceGroup }),
      ...valueConstraint(site, decl),
      ...(description === undefined ? {} : { description }),
      source: located(decl, declDoc),
      ...(site === decl ? {} : { use: located(site, doc) }),
    };
  }

  private leaf(
    base: ReturnType<Builder['elementBase']>,
    decl: ModelNode,
    declDoc: SchemaDoc,
    recursive: boolean,
  ): FieldNode {
    const typeAttr = decl.attrs.type;
    const q = typeAttr === undefined ? undefined : this.table.qname(decl, declDoc, typeAttr);
    return {
      ...base,
      kind: 'group',
      xsdType: { ...(q ? { declared: this.name(q) } : {}), builtin: ANY_TYPE, variety: 'complex' },
      facets: [],
      wildcards: [],
      recursive,
      children: [],
    };
  }

  private unresolvedElement(
    site: ModelNode,
    doc: SchemaDoc,
    particle: Particle,
    q: QName,
  ): FieldNode {
    const base = this.elementBase(site, site, doc, doc, q.namespace, particle);
    return {
      ...base,
      name: q.local,
      kind: 'field',
      xsdType: { builtin: ANY_SIMPLE, variety: 'atomic' },
      facets: [],
      wildcards: [],
      recursive: false,
      children: [],
    };
  }

  // ---- types ----------------------------------------------------------------------------------

  /** The content of a named type (or a built-in). */
  private typeContent(
    site: ModelNode,
    doc: SchemaDoc,
    value: string,
    stack: readonly string[],
  ): Content {
    const q = this.table.qname(site, doc, value);
    if (q?.namespace === NS.xsd) {
      return q.local === 'anyType'
        ? emptyComplex(ANY_TYPE, true)
        : simpleContent(builtinInfo(q.local));
    }
    const g = this.resolve('type', site, doc, value);
    if (!g) return simpleContent({ builtin: ANY_SIMPLE, variety: 'atomic', facets: [] });
    if (g.node.key === 'xsd:simpleType')
      return simpleContent(this.simple(g.node, g.doc, new Set()));
    const id = `type ${g.doc.file} ${g.node.path}`;
    if (stack.includes(id)) return { ...emptyComplex(ANY_TYPE), recursive: true };
    return this.complex(g.node, g.doc, [...stack, id]);
  }

  private complex(ct: ModelNode, doc: SchemaDoc, stack: readonly string[]): Content {
    const mixed = isTrue(ct.attrs.mixed);
    const sc = ct.children.find((c) => c.key === 'xsd:simpleContent');
    if (sc) return this.simpleContentType(sc, doc, stack);
    const cc = ct.children.find((c) => c.key === 'xsd:complexContent');
    if (cc) {
      const derivation = cc.children.find(
        (c) => c.key === 'xsd:extension' || c.key === 'xsd:restriction',
      );
      const isMixed = mixed || isTrue(cc.attrs.mixed);
      if (!derivation) return emptyComplex(ANY_TYPE);
      const own = this.model(derivation, doc, stack, isMixed);
      if (derivation.attrs.base === undefined) return own;
      const base = this.typeContent(derivation, doc, derivation.attrs.base, stack);
      if (derivation.key === 'xsd:restriction') {
        // XML Schema 1.0 Part 1 §3.4.2, complex content, {attribute uses} clause 3: a restriction
        // restates its particles but inherits the base's attribute uses, except those it
        // redeclares (3.1) or prohibits (3.2). Elements and the attribute wildcard are its own.
        return {
          ...own,
          attributes: mergeAttributes(without(base.attributes, own.prohibited), own.attributes),
          recursive: base.recursive || own.recursive,
        };
      }
      return {
        ...own,
        kind: own.kind === 'richText' || base.kind === 'richText' ? 'richText' : own.kind,
        elements: [...base.elements, ...own.elements],
        attributes: mergeAttributes(base.attributes, own.attributes),
        wildcards: [...base.wildcards, ...own.wildcards],
        recursive: base.recursive || own.recursive,
      };
    }
    return this.model(ct, doc, stack, mixed);
  }

  /** Particles and attribute declarations directly under `holder` (a complexType or a derivation). */
  private model(
    holder: ModelNode,
    doc: SchemaDoc,
    stack: readonly string[],
    mixed: boolean,
  ): Content {
    const elements: FieldNode[] = [];
    const wildcards: Wildcard[] = [];
    let rich = false;
    let recursive = false;
    const sink = {
      element: (n: FieldNode) => elements.push(n),
      any: (a: ModelNode) => {
        if (mixed && a.attrs.namespace?.trim() === XHTML) rich = true;
        else wildcards.push(wildcard('any', a));
      },
      recursive: () => (recursive = true),
    };
    for (const c of holder.children) {
      if (['xsd:sequence', 'xsd:choice', 'xsd:all', 'xsd:group'].includes(c.key)) {
        this.particle(c, doc, { steps: [], occurs: { min: 1, max: 1 } }, stack, sink);
      }
    }
    const attrs = this.attributeDecls(holder, doc, stack, new Set());
    return {
      kind: rich ? 'richText' : 'group',
      variety: 'complex',
      builtin: ANY_TYPE,
      facets: [],
      elements,
      attributes: attrs.nodes,
      wildcards: [...wildcards, ...attrs.wildcards],
      recursive: recursive || attrs.recursive,
      prohibited: attrs.prohibited,
    };
  }

  private particle(
    p: ModelNode,
    doc: SchemaDoc,
    outer: Particle,
    stack: readonly string[],
    sink: { element(n: FieldNode): void; any(a: ModelNode): void; recursive(): void },
  ): void {
    const occurs = {
      min: outer.occurs.min * occursOf(p.attrs.minOccurs),
      max: outer.occurs.max * occursOf(p.attrs.maxOccurs),
    };
    const raw = {
      ...(p.attrs.minOccurs === undefined ? {} : { minOccurs: p.attrs.minOccurs }),
      ...(p.attrs.maxOccurs === undefined ? {} : { maxOccurs: p.attrs.maxOccurs }),
    };
    if (p.key === 'xsd:group') {
      const ref = p.attrs.ref;
      if (ref === undefined) return;
      const g = this.resolve('group', p, doc, ref);
      if (!g) return;
      const id = `group ${g.doc.file} ${g.node.path}`;
      if (stack.includes(id)) {
        sink.recursive();
        return;
      }
      const q = this.table.qname(p, doc, ref)!;
      const step: GroupStep = { kind: 'group', ref: this.name(q), ...raw };
      const inner: Particle = { ...outer, steps: [...outer.steps, step], occurs };
      for (const c of g.node.children) {
        if (['xsd:sequence', 'xsd:choice', 'xsd:all'].includes(c.key)) {
          this.particle(c, g.doc, inner, [...stack, id], sink);
        }
      }
      return;
    }
    const kind = p.key.slice('xsd:'.length) as 'sequence' | 'choice' | 'all';
    const inner: Particle = {
      steps: [...outer.steps, { kind, ...raw }],
      occurs,
      ...(kind === 'choice'
        ? { choiceGroup: `choice-${++this.choices}` }
        : outer.choiceGroup === undefined
          ? {}
          : { choiceGroup: outer.choiceGroup }),
    };
    for (const c of p.children) {
      if (c.key === 'xsd:element') sink.element(this.element(c, doc, inner, stack));
      else if (c.key === 'xsd:any') sink.any(c);
      else if (['xsd:sequence', 'xsd:choice', 'xsd:all', 'xsd:group'].includes(c.key)) {
        this.particle(c, doc, inner, stack, sink);
      }
    }
  }

  private simpleContentType(sc: ModelNode, doc: SchemaDoc, stack: readonly string[]): Content {
    const d = sc.children.find((c) => c.key === 'xsd:extension' || c.key === 'xsd:restriction');
    if (!d) return simpleContent({ builtin: ANY_SIMPLE, variety: 'atomic', facets: [] });
    let info: SimpleInfo = { builtin: ANY_SIMPLE, variety: 'atomic', facets: [] };
    let baseAttrs: readonly FieldNode[] = [];
    let baseWildcards: readonly Wildcard[] = [];
    const restriction = d.key === 'xsd:restriction';
    if (d.attrs.base !== undefined) {
      const base = this.typeContent(d, doc, d.attrs.base, stack);
      info = { ...base, variety: base.variety === 'complex' ? 'atomic' : base.variety };
      baseAttrs = base.attributes;
      // A restriction's attribute wildcard is its own (§3.4.2, the complete wildcard).
      baseWildcards = restriction ? [] : base.wildcards;
    }
    if (d.key === 'xsd:restriction')
      info = { ...info, facets: [...info.facets, ...facetsOf(d, doc)] };
    const attrs = this.attributeDecls(d, doc, stack, new Set());
    // §3.4.2, simple content, {attribute uses} clause 3: as for complex content.
    const inherited = restriction ? without(baseAttrs, attrs.prohibited) : baseAttrs;
    return {
      ...simpleContent(info),
      attributes: mergeAttributes(inherited, attrs.nodes),
      wildcards: [...baseWildcards, ...attrs.wildcards],
      recursive: attrs.recursive,
    };
  }

  /** `simpleType` → built-in, variety, item and member types, facets (base type's first). */
  simple(st: ModelNode, doc: SchemaDoc, seen: Set<string>): SimpleInfo {
    const id = `${doc.file} ${st.path}`;
    if (seen.has(id)) return { builtin: ANY_SIMPLE, variety: 'atomic', facets: [] };
    seen.add(id);
    const r = st.children.find((c) => c.key === 'xsd:restriction');
    if (r) {
      const inline = r.children.find((c) => c.key === 'xsd:simpleType');
      const base =
        r.attrs.base !== undefined
          ? this.simpleRef(r, doc, r.attrs.base, seen)
          : inline
            ? this.simple(inline, doc, seen)
            : { builtin: ANY_SIMPLE, variety: 'atomic' as const, facets: [] };
      return { ...base, facets: [...base.facets, ...facetsOf(r, doc)] };
    }
    const list = st.children.find((c) => c.key === 'xsd:list');
    if (list) {
      const inline = list.children.find((c) => c.key === 'xsd:simpleType');
      let itemType: TypeName = ANY_SIMPLE;
      if (list.attrs.itemType !== undefined) {
        const q = this.table.qname(list, doc, list.attrs.itemType);
        itemType = q ? this.name(q) : list.attrs.itemType;
        this.simpleRef(list, doc, list.attrs.itemType, seen);
      } else if (inline) itemType = this.simple(inline, doc, seen).builtin;
      return { builtin: ANY_SIMPLE, variety: 'list', itemType, facets: [] };
    }
    const union = st.children.find((c) => c.key === 'xsd:union');
    if (union) {
      const members: TypeName[] = [];
      const infos: SimpleInfo[] = [];
      for (const m of (union.attrs.memberTypes ?? '').split(/\s+/).filter(Boolean)) {
        const q = this.table.qname(union, doc, m);
        members.push(q ? this.name(q) : m);
        infos.push(this.simpleRef(union, doc, m, new Set(seen)));
      }
      for (const inline of union.children.filter((c) => c.key === 'xsd:simpleType')) {
        const info = this.simple(inline, doc, new Set(seen));
        members.push(info.builtin);
        infos.push(info);
      }
      return {
        builtin: ANY_SIMPLE,
        variety: 'union',
        memberTypes: members,
        members: infos,
        facets: [],
      };
    }
    return { builtin: ANY_SIMPLE, variety: 'atomic', facets: [] };
  }

  private simpleRef(site: ModelNode, doc: SchemaDoc, value: string, seen: Set<string>): SimpleInfo {
    const q = this.table.qname(site, doc, value);
    if (q?.namespace === NS.xsd) return builtinInfo(q.local);
    const g = this.resolve('type', site, doc, value);
    if (!g || g.node.key !== 'xsd:simpleType') {
      return { builtin: ANY_SIMPLE, variety: 'atomic', facets: [] };
    }
    return this.simple(g.node, g.doc, seen);
  }

  // ---- attributes -----------------------------------------------------------------------------

  private attributeDecls(
    holder: ModelNode,
    doc: SchemaDoc,
    stack: readonly string[],
    groups: Set<string>,
  ): {
    nodes: FieldNode[];
    wildcards: Wildcard[];
    recursive: boolean;
    prohibited: Set<string>;
  } {
    const nodes: FieldNode[] = [];
    const wildcards: Wildcard[] = [];
    const prohibited = new Set<string>();
    let recursive = false;
    for (const c of holder.children) {
      if (c.key === 'xsd:attribute') {
        const node = this.attribute(c, doc);
        // use="prohibited" declares nothing (§3.2 note); directly in a restriction it removes the
        // inherited attribute of that name (§3.4.2 clause 3.2), which the caller applies.
        if (c.attrs.use?.trim() === 'prohibited') prohibited.add(attrKey(node));
        else nodes.push(node);
      } else if (c.key === 'xsd:anyAttribute') wildcards.push(wildcard('anyAttribute', c));
      else if (c.key === 'xsd:attributeGroup' && c.attrs.ref !== undefined) {
        const g = this.resolve('attributeGroup', c, doc, c.attrs.ref);
        if (!g) continue;
        const id = `${g.doc.file} ${g.node.path}`;
        if (groups.has(id)) {
          recursive = true;
          continue;
        }
        const inner = this.attributeDecls(g.node, g.doc, stack, new Set([...groups, id]));
        nodes.push(...inner.nodes);
        wildcards.push(...inner.wildcards);
        recursive ||= inner.recursive;
      }
    }
    return { nodes, wildcards, recursive, prohibited };
  }

  private attribute(site: ModelNode, doc: SchemaDoc): FieldNode {
    let decl = site;
    let declDoc = doc;
    let namespace: string | null;
    let name = site.attrs.name ?? '';
    const ref = site.attrs.ref;
    if (ref !== undefined) {
      const q = this.table.qname(site, doc, ref);
      const g = this.resolve('attribute', site, doc, ref);
      name = g?.name ?? q?.local ?? ref;
      namespace = g?.namespace ?? q?.namespace ?? null;
      if (g) {
        decl = g.node;
        declDoc = g.doc;
      }
    } else if (isGlobal(site)) {
      namespace = this.table.namespaceOf(doc);
    } else {
      const form = site.attrs.form ?? schemaAttr(doc, 'attributeFormDefault') ?? 'unqualified';
      namespace = form === 'qualified' ? this.table.namespaceOf(doc) : null;
    }
    const typeAttr = decl.attrs.type;
    const inline = decl.children.find((c) => c.key === 'xsd:simpleType');
    let declared: TypeName | undefined;
    let info: SimpleInfo;
    if (typeAttr !== undefined) {
      const q = this.table.qname(decl, declDoc, typeAttr);
      declared = q ? this.name(q) : typeAttr;
      info = this.simpleRef(decl, declDoc, typeAttr, new Set());
    } else if (inline) info = this.simple(inline, declDoc, new Set());
    else info = { builtin: ANY_SIMPLE, variety: 'atomic', facets: [] };
    const use = site.attrs.use;
    const required = use === 'required';
    const description = describe(decl);
    return {
      name,
      namespace,
      nodeType: 'attribute',
      kind: 'field',
      xsdType: {
        ...(declared === undefined ? {} : { declared }),
        builtin: info.builtin,
        variety: info.variety,
        ...(info.itemType === undefined ? {} : { itemType: info.itemType }),
        ...(info.memberTypes === undefined ? {} : { memberTypes: info.memberTypes }),
      },
      raw: { ...(use === undefined ? {} : { use }), groups: [] },
      effective: { minOccurs: required ? 1 : 0, maxOccurs: 1, nillable: false },
      repeating: false,
      optional: !required,
      required: false,
      facets: info.facets,
      ...valueConstraint(site, decl),
      wildcards: [],
      recursive: false,
      ...(description === undefined ? {} : { description }),
      source: located(decl, declDoc),
      ...(site === decl ? {} : { use: located(site, doc) }),
      children: [],
    };
  }
}

// ---- helpers ------------------------------------------------------------------------------------

function isGlobal(n: ModelNode): boolean {
  return /^\/xsd:schema\[1\]\/xsd:[A-Za-z]+\[\d+\]$/.test(n.path);
}

function schemaAttr(doc: SchemaDoc, name: string): string | undefined {
  return doc.root.attrs[name];
}

function isTrue(v: string | undefined): boolean {
  const t = v?.trim();
  return t === 'true' || t === '1';
}

function occursOf(v: string | undefined): number {
  if (v === undefined) return 1;
  const t = v.trim();
  if (t === 'unbounded') return Infinity;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : 1;
}

function located(n: ModelNode, doc: SchemaDoc): Located {
  return { file: doc.file, path: n.path, line: n.line, column: n.column };
}

function valueConstraint(site: ModelNode, decl: ModelNode): { default?: string; fixed?: string } {
  const d = site.attrs.default ?? decl.attrs.default;
  const f = site.attrs.fixed ?? decl.attrs.fixed;
  return { ...(d === undefined ? {} : { default: d }), ...(f === undefined ? {} : { fixed: f }) };
}

function wildcard(kind: Wildcard['kind'], n: ModelNode): Wildcard {
  const a = n.attrs;
  return {
    kind,
    ...(a.namespace === undefined ? {} : { namespace: a.namespace }),
    ...(a.processContents === undefined ? {} : { processContents: a.processContents }),
    ...(kind === 'any' && a.minOccurs !== undefined ? { minOccurs: a.minOccurs } : {}),
    ...(kind === 'any' && a.maxOccurs !== undefined ? { maxOccurs: a.maxOccurs } : {}),
  };
}

function facetsOf(r: ModelNode, doc: SchemaDoc): Facet[] {
  const out: Facet[] = [];
  for (const c of r.children) {
    const name = c.key.slice('xsd:'.length) as FacetName;
    if (!(FACETS as readonly string[]).includes(name)) continue;
    out.push({
      name,
      value: c.attrs.value ?? '',
      ...(c.attrs.fixed === undefined ? {} : { fixed: c.attrs.fixed }),
      source: located(c, doc),
    });
  }
  return out;
}

function attrKey(n: FieldNode): string {
  return `{${n.namespace ?? ''}}${n.name}`;
}

/** Base attributes first, minus those `own` redeclares (§3.4.2 clause 3.1), then `own`. */
function mergeAttributes(base: readonly FieldNode[], own: readonly FieldNode[]): FieldNode[] {
  const ownKeys = new Set(own.map(attrKey));
  return [...base.filter((n) => !ownKeys.has(attrKey(n))), ...own];
}

function without(attrs: readonly FieldNode[], keys: ReadonlySet<string>): FieldNode[] {
  return attrs.filter((n) => !keys.has(attrKey(n)));
}

function builtinInfo(local: string): SimpleInfo {
  return { builtin: `xsd:${local}`, variety: 'atomic', facets: [] };
}

function simpleContent(info: SimpleInfo): Content {
  return {
    kind: 'field',
    variety: info.variety,
    builtin: info.builtin,
    ...(info.itemType === undefined ? {} : { itemType: info.itemType }),
    ...(info.memberTypes === undefined ? {} : { memberTypes: info.memberTypes }),
    ...(info.members === undefined ? {} : { members: info.members }),
    facets: info.facets,
    elements: [],
    attributes: [],
    wildcards: [],
    recursive: false,
    prohibited: new Set(),
  };
}

/** Complex content with nothing in it; `anyType` admits any element and attribute. */
function emptyComplex(builtin: TypeName, anyType = false): Content {
  return {
    kind: 'group',
    variety: 'complex',
    builtin,
    facets: [],
    elements: [],
    attributes: [],
    wildcards: anyType ? [{ kind: 'any' }, { kind: 'anyAttribute' }] : [],
    recursive: false,
    prohibited: new Set(),
  };
}

/** The text of the first xsd:documentation of the declaration, tags removed. */
function describe(decl: ModelNode): string | undefined {
  const doc = decl.children
    .find((c) => c.key === 'xsd:annotation')
    ?.children.find((c) => c.key === 'xsd:documentation');
  return doc && deepText(doc.element);
}

function deepText(el: XmlElement): string {
  return el.children.map((c) => (c.kind === 'text' ? c.text : deepText(c))).join('');
}

/** The restriction step a facet belongs to: its file and its parent element's path. */
function stepOf(f: Facet): string {
  return `${f.source.file}\u0000${f.source.path.slice(0, f.source.path.lastIndexOf('/'))}`;
}

function splitStep(step: string): [string, string] {
  const i = step.indexOf('\u0000');
  return [step.slice(0, i), step.slice(i + 1)];
}

function toSimpleType(info: SimpleInfo): SimpleTypeInfo {
  return {
    builtin: info.builtin,
    variety: info.variety,
    facets: info.facets.map((f) => ({ name: f.name, value: f.value, step: stepOf(f) })),
    ...(info.members ? { members: info.members.map(toSimpleType) } : {}),
  };
}
