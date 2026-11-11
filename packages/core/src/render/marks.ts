// Control marks and the required asterisk (spec 03 design §9; §8.1 steps 6 and 7; R6.5, R6.6).
//
// At prepare, FormIR's bound controls are indexed by the source position of their XSL element.
// In the run, the adapter's `literalResultElement` hook finds the control for each created
// element and the record node its binding selects (engine/xsltjs.ts). After sanitising, each
// surviving element gets `data-afl-ctrl` and `data-afl-path`, and, when its node is empty and
// its field is required or blank-checked, the asterisk.

import { dataStep } from '../ir/ids';
import type { BoundControl, FormIR, IrGroup, IrView } from '../ir/types';
import { attachmentHeader, sizeText, typeText, type Attachment } from './attachment';
import type { MarkedElement, StructureElement } from './engine/xsltjs';
import type { ControlMark, RowMark } from './render';
import type { HElement, HNode } from './html/serialise';

/** The xmldom members of a record node read here. */
interface SourceNode {
  readonly nodeType: number;
  readonly namespaceURI?: string | null;
  readonly localName?: string | null;
  readonly nodeName: string;
  readonly value?: string;
  readonly textContent?: string | null;
  readonly parentNode?: SourceNode | null;
  readonly ownerElement?: SourceNode | null;
  readonly previousSibling?: SourceNode | null;
  readonly firstChild?: SourceNode | null;
  readonly nextSibling?: SourceNode | null;
}

const key = (file: string, line: number, column: number) =>
  `${file.toLowerCase()}\u0000${line}\u0000${column}`;

/** Design §9.1: `file:line:column` → control, over every control FormIR found in the view. */
export function controlIndex(
  view: IrView,
): (file: string, line: number, column: number) => BoundControl | undefined {
  const byPos = new Map<string, BoundControl>();
  for (const c of view.controls) {
    const k = key(c.source.file, c.source.line, c.source.column);
    if (!byPos.has(k)) byPos.set(k, c);
  }
  return (file, line, column) => byPos.get(key(file, line, column));
}

/** R6.2: FormIR ActiveX control ids by the source position of their `object` element. */
export function activeXIndex(
  ir: FormIR,
): (file: string, line: number, column: number) => string | undefined {
  const byPos = new Map<string, string>();
  for (const c of ir.activeX.controls) {
    const k = key(c.source.file, c.source.line, c.source.column);
    if (!byPos.has(k)) byPos.set(k, c.id);
  }
  return (file, line, column) => byPos.get(key(file, line, column));
}

/** Spec 04 task 8 (D20): the groups a person can add to or remove from, for row marks. */
export interface StructureIndex {
  /** Whether a record node is an item of an `xCollection` or `xOptional` group. */
  readonly isItem: ((node: unknown) => boolean) | undefined;
  /** The row mark of a structure element, or undefined. */
  readonly mark: (s: StructureElement) => RowMark | undefined;
}

export function structureIndex(ir: FormIR, ns: Readonly<Record<string, string>>): StructureIndex {
  const byPath = new Map<string, IrGroup>();
  const byName = new Map<string, IrGroup>();
  for (const g of ir.groups) {
    const c = g.insert?.component;
    if (c !== 'xCollection' && c !== 'xOptional') continue;
    byPath.set(g.path, g);
    byName.set(g.insert!.xmlToEdit, g);
  }
  const locals = new Set([...byPath.values()].map((g) => g.name));
  const groupOf = (node: SourceNode) => {
    if (node.nodeType !== 1 || !locals.has(localOf(node))) return undefined;
    const path = dataPath(node, ns);
    return path === undefined ? undefined : byPath.get(path.replace(/\[\d+\]/g, ''));
  };
  return {
    isItem: byPath.size === 0 ? undefined : (n) => groupOf(n as SourceNode) !== undefined,
    mark: (s) => {
      const node = s.node as SourceNode | undefined;
      const path = node && dataPath(node, ns);
      if (path === undefined) return undefined;
      if (s.insert !== undefined) {
        const g = byName.get(s.insert);
        return g && { kind: 'insert', groupId: g.id, path };
      }
      const g = groupOf(node!);
      if (!g) return undefined;
      return {
        kind: g.insert!.component === 'xOptional' ? 'optional' : 'row',
        groupId: g.id,
        path,
      };
    },
  };
}

/** Design §9.2: the field ids an asterisk may be drawn for. */
export function requiredTargets(ir: FormIR): ReadonlySet<string> {
  const out = new Set<string>();
  for (const f of ir.fields) if (f.required) out.add(f.id);
  for (const v of ir.validations) {
    if (v.matchId === undefined) continue;
    const blank =
      v.kind === 'blank' ||
      (v.expressionContext === '.' && (v.expression ?? '').replace(/\s+/g, '') === '.=""');
    if (blank) out.add(v.matchId);
  }
  return out;
}

/** A rendered control: its mark, and for a filled FileAttachment its header (R6.7). */
export interface Rendered {
  readonly mark: ControlMark;
  readonly attachment?: Attachment;
}

/** The ControlMark of one rendered control, and its attachment header when it has one. */
export function controlMark(
  m: MarkedElement,
  namespaces: Readonly<Record<string, string>>,
  required: ReadonlySet<string>,
): Rendered {
  const { control } = m;
  const node = m.node as SourceNode | undefined;
  const path = node && dataPath(node, namespaces);
  const empty = node !== undefined && isEmpty(node);
  const mark: ControlMark = {
    controlId: control.id,
    ...(path === undefined ? {} : { path }),
    ...(control.targetId === undefined ? {} : { fieldId: control.targetId }),
    empty,
    required: empty && control.targetId !== undefined && required.has(control.targetId),
  };
  const isAttachment = control.xctname?.toLowerCase() === 'fileattachment';
  if (!isAttachment || !node || empty) return { mark };
  return { mark, attachment: attachmentHeader(node.textContent ?? node.value ?? '') };
}

/** No element children and an empty string value (design §9.2). */
function isEmpty(node: SourceNode): boolean {
  if (node.nodeType === 2) return (node.value ?? '') === '';
  if (node.nodeType !== 1) return false;
  for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) return false;
  return (node.textContent ?? '') === '';
}

/**
 * Design §9.1: `/my:a[1]/my:b[2]` from the document down, with the manifest's prefixes and
 * 1-based positions among same-name siblings; an attribute adds `/@name`. Undefined for any
 * other node kind.
 */
/** Spec 03 mark paths; spec 04 D3 addresses nodes with them too. */
export function dataPath(
  node: SourceNode,
  ns: Readonly<Record<string, string>>,
): string | undefined {
  if (node.nodeType === 2) {
    const owner = node.ownerElement;
    const base = owner && dataPath(owner, ns);
    return base === undefined
      ? undefined
      : `${base}/${dataStep(node.namespaceURI ?? null, localOf(node), 'attribute', ns)}`;
  }
  if (node.nodeType !== 1) return undefined;
  const steps: string[] = [];
  for (let n: SourceNode | null | undefined = node; n && n.nodeType === 1; n = n.parentNode) {
    const uri = n.namespaceURI ?? null;
    const local = localOf(n);
    let pos = 1;
    for (let s = n.previousSibling; s; s = s.previousSibling) {
      if (s.nodeType === 1 && (s.namespaceURI ?? null) === uri && localOf(s) === local) pos++;
    }
    steps.push(`${dataStep(uri, local, 'element', ns)}[${pos}]`);
  }
  return `/${steps.reverse().join('/')}`;
}

const localOf = (n: SourceNode) => n.localName ?? n.nodeName.replace(/^.*:/, '');

const REPLACED = new Set(['input', 'select', 'textarea']);

/**
 * §8.1 steps 6 and 7, in document order: `data-afl-ctrl` and `data-afl-path` on each marked
 * element that survived sanitising, then the asterisk: class `afl-required`, and after an
 * `input`, `select` or `textarea`, which cannot show `::after`, a mark span.
 */
export function applyMarks(
  root: HElement,
  markOf: (origin: object) => Rendered | undefined,
  rowOf: (origin: object) => RowMark | undefined = () => undefined,
): { marks: ControlMark[]; rows: RowMark[]; unreadable: Map<string, number> } {
  const marks: ControlMark[] = [];
  const rows: RowMark[] = [];
  const unreadable = new Map<string, number>();
  const walk = (children: HNode[]) => {
    for (let i = 0; i < children.length; i++) {
      const el = children[i]!;
      if (el.kind !== 'element') continue;
      const rendered = el.origin && markOf(el.origin);
      const mark = rendered?.mark;
      // Spec 04 task 8: rows, optional sections and insert placeholders (D20).
      const row = el.origin && rowOf(el.origin);
      if (row) {
        rows.push(row);
        el.attrs.push(
          ['data-afl-structure', row.kind],
          ['data-afl-group', row.groupId],
          ['data-afl-node', row.path],
        );
      }
      if (rendered?.attachment) {
        const a = rendered.attachment;
        if ('problem' in a) unreadable.set(a.problem, (unreadable.get(a.problem) ?? 0) + 1);
        el.children.push(attachmentView(a));
      }
      if (mark) {
        marks.push(mark);
        if (mark.required) {
          const cls = el.attrs.find(([n]) => n === 'class');
          if (cls) cls[1] = cls[1] === '' ? 'afl-required' : `${cls[1]} afl-required`;
          else el.attrs.push(['class', 'afl-required']);
        }
        el.attrs.push(['data-afl-ctrl', mark.controlId]);
        if (mark.path !== undefined) el.attrs.push(['data-afl-path', mark.path]);
      }
      walk(el.children);
      if (mark?.required && REPLACED.has(el.name)) {
        children.splice(i + 1, 0, {
          kind: 'element',
          name: 'span',
          attrs: [
            ['class', 'afl-required-mark'],
            ['aria-hidden', 'true'],
          ],
          children: [{ kind: 'text', text: '*' }],
        });
        i++;
      }
    }
  };
  walk(root.children);
  return { marks, rows, unreadable };
}

/**
 * R6.7: a filled FileAttachment as InfoPath showed it (`Changed at review:` a block, not a line):
 * our file icon at the left, then three lines, the name, the type and the size, with the full
 * name in `title`. The icon alone when the header is unreadable. The name is record data: a text
 * node and an attribute value, both escaped by the serialiser.
 */
function attachmentView(a: Attachment): HElement {
  const span = (cls: string, text?: string, hidden = false): HElement => ({
    kind: 'element',
    name: 'span',
    attrs: [['class', cls], ...(hidden ? [['aria-hidden', 'true'] as [string, string]] : [])],
    children: text === undefined ? [] : [{ kind: 'text', text }],
  });
  const icon = span('afl-icon afl-icon-file', undefined, true);
  if ('problem' in a)
    return {
      kind: 'element',
      name: 'span',
      attrs: [['class', 'afl-attachment']],
      children: [icon],
    };
  const text: HElement = {
    kind: 'element',
    name: 'span',
    attrs: [['class', 'afl-attachment-text']],
    children: [
      span('afl-attachment-name', a.name),
      span('afl-attachment-type', typeText(a.name)),
      span('afl-attachment-size', sizeText(a.size)),
    ],
  };
  return {
    kind: 'element',
    name: 'span',
    attrs: [
      ['class', 'afl-attachment afl-attachment-filled'],
      ['title', a.name],
    ],
    children: [icon, text],
  };
}
