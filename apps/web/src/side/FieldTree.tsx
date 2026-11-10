// Spec 09 R4.1, R4.2, R9.2: the field tree as an ARIA tree with one tab stop (roving tabindex).
// Arrow keys move, Right and Left open and close groups, Enter or Space selects.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FormIR } from '@afterlife/core';
import { markersOf } from './markers';
import { buildTree, typeWords, type TreeNode } from './tree';

interface Props {
  readonly ir: FormIR;
  readonly selected: string | undefined;
  readonly onSelect: (fieldId: string) => void;
}

interface Row {
  readonly id: string;
  readonly level: number;
  readonly parent?: string;
  readonly hasChildren: boolean;
  readonly item: TreeNode | { readonly source: string };
}

const sourceId = (s: string) => `source:${s}`;

export function FieldTree({ ir, selected, onSelect }: Props) {
  const roots = useMemo(() => buildTree(ir), [ir]);
  const markers = useMemo(() => markersOf(ir), [ir]);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [focus, setFocus] = useState<string>();
  const list = useRef<HTMLUListElement>(null);

  const parents = useMemo(() => {
    const m = new Map<string, string>();
    const visit = (n: TreeNode, parent: string) => {
      m.set(n.id, parent);
      n.children.forEach((c) => visit(c, n.id));
    };
    roots.forEach((r) => r.children.forEach((c) => visit(c, sourceId(r.dataSource))));
    return m;
  }, [roots]);

  // A field selected from the paper: open its groups and bring it into view.
  useEffect(() => {
    if (!selected || !parents.has(selected)) return;
    const up: string[] = [];
    for (let p = parents.get(selected); p; p = parents.get(p)) up.push(p);
    setClosed((c) =>
      up.some((p) => c.has(p)) ? new Set([...c].filter((x) => !up.includes(x))) : c,
    );
    setFocus(selected);
  }, [selected, parents]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const add = (n: TreeNode, level: number, parent: string) => {
      out.push({ id: n.id, level, parent, hasChildren: n.children.length > 0, item: n });
      if (!closed.has(n.id)) n.children.forEach((c) => add(c, level + 1, n.id));
    };
    for (const r of roots) {
      const id = sourceId(r.dataSource);
      out.push({
        id,
        level: 1,
        hasChildren: r.children.length > 0,
        item: { source: r.dataSource },
      });
      if (!closed.has(id)) r.children.forEach((c) => add(c, 2, id));
    }
    return out;
  }, [roots, closed]);

  const current = focus !== undefined && rows.some((r) => r.id === focus) ? focus : rows[0]?.id;

  useEffect(() => {
    if (!current) return;
    const box = list.current;
    const el = box?.querySelector<HTMLElement>(`[data-id="${CSS.escape(current)}"]`);
    if (!box || !el) return;
    // Scroll the tree only: scrollIntoView would also scroll the page under the pointer.
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
    if (box.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [current]);

  const toggle = (id: string, open: boolean) =>
    setClosed((c) => {
      const n = new Set(c);
      if (open) n.delete(id);
      else n.add(id);
      return n;
    });

  function onKey(e: KeyboardEvent) {
    const i = rows.findIndex((r) => r.id === current);
    const row = rows[i];
    if (!row) return;
    const go = (id: string | undefined) => {
      if (id === undefined) return;
      e.preventDefault();
      setFocus(id);
      list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus();
    };
    switch (e.key) {
      case 'ArrowDown':
        return go(rows[i + 1]?.id);
      case 'ArrowUp':
        return go(rows[i - 1]?.id);
      case 'Home':
        return go(rows[0]?.id);
      case 'End':
        return go(rows.at(-1)?.id);
      case 'ArrowRight':
        if (row.hasChildren && closed.has(row.id)) {
          e.preventDefault();
          return toggle(row.id, true);
        }
        return go(row.hasChildren ? rows[i + 1]?.id : undefined);
      case 'ArrowLeft':
        if (row.hasChildren && !closed.has(row.id)) {
          e.preventDefault();
          return toggle(row.id, false);
        }
        return go(row.parent);
      case 'Enter':
      case ' ':
        e.preventDefault();
        if ('node' in row.item) onSelect(row.id);
        else toggle(row.id, closed.has(row.id));
    }
  }

  return (
    <ul className="afl-tree" role="tree" aria-label="Fields" ref={list} onKeyDown={onKey}>
      {rows.map((r) => {
        const isNode = 'node' in r.item;
        const labelId = `afl-ti-${rows.indexOf(r)}`;
        return (
          <li
            key={r.id}
            role="treeitem"
            data-id={r.id}
            aria-level={r.level}
            aria-labelledby={labelId}
            {...(r.hasChildren && { 'aria-expanded': !closed.has(r.id) })}
            {...(isNode && { 'aria-selected': r.id === selected })}
            tabIndex={r.id === current ? 0 : -1}
            className="afl-tree-row"
            style={{ paddingLeft: `${(r.level - 1) * 16 + 4}px` }}
            onClick={() => {
              setFocus(r.id);
              if (isNode) onSelect(r.id);
              else toggle(r.id, closed.has(r.id));
            }}
          >
            <span className="afl-tree-twist" aria-hidden="true">
              {r.hasChildren ? (closed.has(r.id) ? '▸' : '▾') : ''}
            </span>
            {'node' in r.item ? (
              <NodeRow labelId={labelId} t={r.item} m={markers.get(r.id)} />
            ) : (
              <span id={labelId} className="afl-tree-source">
                {r.item.source === 'main'
                  ? 'Main data source'
                  : `Data connection: ${r.item.source}`}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NodeRow({
  labelId,
  t,
  m,
}: {
  readonly labelId: string;
  readonly t: TreeNode;
  readonly m: ReturnType<typeof markersOf> extends Map<string, infer M> ? M | undefined : never;
}) {
  const n = t.node;
  const chips = [
    m?.required && 'Required',
    n.kind !== 'group' && n.repeating && 'Repeating',
    m?.rule && 'Rule',
    m?.calculated && 'Calculated',
    m?.validated && 'Validated',
    m?.connection && 'From data connection',
  ].filter((c): c is string => typeof c === 'string');
  return (
    <span id={labelId} className="afl-tree-node">
      <span className="afl-tree-label">{n.label}</span>
      <span className="afl-sub">{typeWords(n)}</span>
      {chips.map((c) => (
        <span key={c} className="afl-chip">
          {c}
        </span>
      ))}
    </span>
  );
}
