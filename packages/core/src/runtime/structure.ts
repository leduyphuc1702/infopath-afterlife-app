// Spec 04 task 9 (D18, D19): items of repeating groups and optional sections. Pure DOM work on
// the record; FillSession runs the cycle afterwards.

import type { FormIR, IrGroup } from '../ir/types';
import { resolveLimits } from '../limits';
import { parseXmlDom, xmlContext } from '../xml/parse';
import type { RtDocument, RtNode } from './evaluate';
import { local } from './model';

const XSI = 'http://www.w3.org/2001/XMLSchema-instance';

interface Dom extends RtNode {
  insertBefore(n: RtNode, ref: RtNode | null): RtNode;
  importNode?(n: RtNode, deep: boolean): RtNode;
  createElementNS(ns: string | null, q: string): RtNode;
  setAttributeNS(ns: string, q: string, v: string): void;
}

const elements = (n: RtNode): RtNode[] => Array.from(n.childNodes).filter((c) => c.nodeType === 1);

const same = (a: RtNode, ns: string | null, name: string) =>
  a.nodeType === 1 && (a.namespaceURI ?? null) === ns && local(a) === name;

export class Structure {
  /** Wrappers this session created around a first item; removed again with their last item. */
  private readonly created = new WeakSet<RtNode>();
  private readonly fragments = new Map<string, { wrapper: RtNode[]; item: RtNode } | null>();

  constructor(
    private readonly ir: FormIR,
    private readonly doc: RtNode,
    private readonly idOf: (n: RtNode) => string | undefined,
  ) {}

  /** The children of a group, in schema order (their XSD source position). */
  private order(groupId: string): IrGroup['id'][] {
    return [...this.ir.groups, ...this.ir.fields]
      .filter((n) => n.groupId === groupId && n.nodeType === 'element')
      .sort((a, b) => a.source.line - b.source.line || a.source.column - b.source.column)
      .map((n) => n.id);
  }

  /** D18: the item element of the group's fragment, and the wrappers above it; parsed once. */
  private fragment(g: IrGroup): { wrapper: RtNode[]; item: RtNode } | null {
    if (this.fragments.has(g.id)) return this.fragments.get(g.id)!;
    let out: { wrapper: RtNode[]; item: RtNode } | null = null;
    const f = g.insert?.fragments[0];
    if (f) {
      const bytes = new TextEncoder().encode(`<afl-fragment>${f.xml}</afl-fragment>`);
      const doc = parseXmlDom(bytes, 'manifest.xsf', xmlContext(resolveLimits())).doc as unknown;
      let at = (doc as RtNode).documentElement!;
      const wrapper: RtNode[] = [];
      const steps = (f.innerFragment ?? g.name).split('/').map((s) => s.replace(/^.*:/, ''));
      for (const s of steps) {
        const next = elements(at).find((c) => local(c) === s);
        if (!next) break;
        if (local(next) !== g.name) wrapper.push(next);
        at = next;
      }
      if (local(at) === g.name && (at.namespaceURI ?? null) === g.namespace)
        out = { wrapper, item: at };
    }
    this.fragments.set(g.id, out);
    return out;
  }

  /** A fresh item: the fragment's, or one built from the schema (required children, defaults). */
  newItem(g: IrGroup): RtNode {
    const d = this.doc as Dom;
    const f = this.fragment(g);
    if (f) return this.tidy(d.importNode!(f.item, true));
    return this.build(g.id);
  }

  /** Drops namespace declarations the record's root already makes (the fragment repeats them). */
  tidy(n: RtNode): RtNode {
    const root = this.doc.documentElement!;
    const declared = new Map(
      Array.from(root.attributes ?? [])
        .filter((a) => a.nodeName.startsWith('xmlns'))
        .map((a) => [a.nodeName, a.value]),
    );
    const walk = (el: RtNode) => {
      for (const a of Array.from(el.attributes ?? []))
        if (a.nodeName.startsWith('xmlns') && declared.get(a.nodeName) === a.value)
          (el as unknown as { removeAttributeNode(a: RtNode): void }).removeAttributeNode(a);
      for (const c of elements(el)) walk(c);
    };
    walk(n);
    return n;
  }

  private build(id: string): RtNode {
    const d = this.doc as Dom;
    const n = [...this.ir.groups, ...this.ir.fields].find((x) => x.id === id)!;
    const q = n.namespace === null ? n.name : `${this.prefix(n.namespace)}${n.name}`;
    const el = d.createElementNS(n.namespace, q) as Dom;
    if (n.kind === 'group') {
      for (const c of this.order(n.id)) {
        const child = [...this.ir.groups, ...this.ir.fields].find((x) => x.id === c)!;
        if (!child.optional) el.appendChild!(this.build(c));
      }
    } else {
      const v = n.fixed ?? n.default;
      if (v !== undefined) el.appendChild!((this.doc as RtDocument).createTextNode(v));
      else if (n.xsdType.builtin !== 'xsd:string') el.setAttributeNS(XSI, 'xsi:nil', 'true');
    }
    return el;
  }

  private prefix(ns: string): string {
    const root = this.doc.documentElement!;
    const p = Array.from(root.attributes ?? []).find(
      (a) => a.nodeName.startsWith('xmlns:') && a.value === ns,
    );
    return p ? `${p.nodeName.slice(6)}:` : '';
  }

  /** Inserts `node` into `parent` at its schema position among `parent`'s children. */
  private placeIn(parent: RtNode, parentId: string | undefined, node: RtNode): void {
    const order = parentId === undefined ? [] : this.order(parentId);
    const ids = [...this.ir.groups, ...this.ir.fields];
    const rank = (n: RtNode) =>
      order.findIndex((id) => {
        const x = ids.find((i) => i.id === id)!;
        return same(n, x.namespace, x.name);
      });
    const mine = rank(node);
    const after = elements(parent).find((c) => rank(c) > mine && mine >= 0);
    (parent as Dom).insertBefore(node, after ?? null);
  }

  /** "Insert item" (R7.1): after the last item under `context`, creating wrappers as needed. */
  append(g: IrGroup, context: RtNode): RtNode {
    const f = this.fragment(g);
    const chain = this.chain(g, context);
    let parent = context;
    let parentId = this.groupIdOf(context);
    for (const w of chain) {
      const found = elements(parent).find((c) => same(c, w.namespace, w.name));
      if (found) {
        parent = found;
        parentId = w.id;
        continue;
      }
      const d = this.doc as Dom;
      const fw = f?.wrapper.find((x) => local(x) === w.name);
      const made = fw
        ? this.tidy(d.importNode!(fw, false))
        : d.createElementNS(w.namespace, `${w.namespace ? this.prefix(w.namespace) : ''}${w.name}`);
      this.placeIn(parent, parentId, made);
      this.created.add(made);
      parent = made;
      parentId = w.id;
    }
    const item = this.newItem(g);
    const items = elements(parent).filter((c) => same(c, g.namespace, g.name));
    const last = items[items.length - 1];
    if (last) (parent as Dom).insertBefore(item, last.nextSibling);
    else this.placeIn(parent, parentId, item);
    return item;
  }

  /** R7.2: a new item right before or after `row`. */
  beside(g: IrGroup, row: RtNode, where: 'before' | 'after'): RtNode {
    const item = this.newItem(g);
    (row.parentNode as Dom).insertBefore(item, where === 'before' ? row : row.nextSibling);
    return item;
  }

  /** R7.2: removes `row`; refused (false) when it is the last one and the schema needs one. */
  remove(g: IrGroup, row: RtNode): { ok: boolean; next?: RtNode } {
    const parent = row.parentNode!;
    const siblings = elements(parent).filter((c) => same(c, g.namespace, g.name));
    if (siblings.length === 1 && !g.optional && g.insert?.component !== 'xOptional')
      return { ok: false };
    const i = siblings.indexOf(row);
    const next = siblings[i + 1] ?? siblings[i - 1];
    parent.removeChild!(row);
    // A wrapper this session made for the first item goes with the last one (P3).
    let w: RtNode | null = parent;
    while (w && this.created.has(w) && elements(w).length === 0) {
      const up: RtNode | null = w.parentNode;
      up?.removeChild!(w);
      w = up;
    }
    return next ? { ok: true, next } : { ok: true };
  }

  /** The groups between `context` and the item's group, outermost first. */
  private chain(g: IrGroup, context: RtNode): IrGroup[] {
    const out: IrGroup[] = [];
    const contextId = this.groupIdOf(context);
    for (let id = g.groupId; id !== undefined && id !== contextId;) {
      const p = this.ir.groups.find((x) => x.id === id);
      if (!p) break;
      out.unshift(p);
      id = p.groupId;
    }
    return out;
  }

  private groupIdOf(n: RtNode): string | undefined {
    return this.idOf(n);
  }
}
