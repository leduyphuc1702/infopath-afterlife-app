// Spec 04 task 9 (R7.1–R7.3, D20): "Insert item", "Click here to insert" and the row menu on the
// paper, from core's row marks (`data-afl-structure`, `data-afl-group`, `data-afl-node`). Plain
// DOM inside the paper's shadow root, like fill.ts; the page's React menus do not reach it.

import type { FillCommand, FilledRes } from '../worker/protocol';

const handled = new WeakSet<FilledRes>();

const rowNumber = (path: string) => Number(/\[(\d+)\]$/.exec(path)?.[1] ?? '1');

/** Makes placeholders operable and gives each row and present section its menu button. */
export function upgradeRows(root: ShadowRoot, res: FilledRes): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-afl-structure]')) {
    const kind = el.dataset.aflStructure;
    const group = res.groups[el.dataset.aflGroup ?? ''] ?? 'this group';
    if (kind === 'insert') {
      const optional = el.getAttribute('xd:action') === 'xOptional::insert';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute(
        'aria-label',
        optional ? `Insert ${group}` : `Insert a row at the end of ${group}`,
      );
      continue;
    }
    const node = el.dataset.aflNode ?? '';
    const name = kind === 'optional' ? group : `row ${rowNumber(node)} of ${group}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'afl-row-button';
    button.dataset.aflRowMenu = '';
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `Actions for ${name}`);
    button.title = `Actions for ${name}`;
    button.textContent = '⋯';
    // A table row's button sits in its last cell, so the table keeps its columns.
    const host = el.tagName === 'TR' ? ((el.lastElementChild as HTMLElement | null) ?? el) : el;
    host.classList.add('afl-row-host');
    host.append(button);
  }
}

/** After an insert or remove: focus the first control of `res.focus`'s item, once per answer. */
export function focusItem(root: ShadowRoot, res: FilledRes, group?: string): boolean {
  if (handled.has(res)) return false;
  handled.add(res);
  const item =
    res.focus === undefined
      ? undefined
      : root.querySelector<HTMLElement>(
          `[data-afl-structure][data-afl-node="${CSS.escape(res.focus)}"]`,
        );
  const target =
    item?.querySelector<HTMLElement>('[data-afl-edit]:not([data-afl-readonly])') ??
    item?.querySelector<HTMLElement>('[data-afl-row-menu]') ??
    (group === undefined
      ? undefined
      : root.querySelector<HTMLElement>(
          `[data-afl-structure="insert"][data-afl-group="${CSS.escape(group)}"]`,
        ));
  if (!target) return false;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}

/** Click and keyboard for placeholders and row menus; returns a cleanup function. */
export function listenRows(root: ShadowRoot, send: (c: FillCommand) => void): () => void {
  let open: { menu: HTMLElement; button: HTMLElement } | undefined;
  const close = (refocus: boolean) => {
    if (!open) return;
    open.menu.remove();
    open.button.setAttribute('aria-expanded', 'false');
    if (refocus) open.button.focus();
    open = undefined;
  };
  const itemOf = (el: Element) => el.closest<HTMLElement>('[data-afl-structure]');
  const insertAt = (el: HTMLElement) => {
    const group = el.dataset.aflGroup!;
    const at = el.dataset.aflNode!;
    send(
      el.getAttribute('xd:action') === 'xOptional::insert'
        ? { kind: 'insertOptional', groupId: group, in: at }
        : { kind: 'insertRow', groupId: group, at: { in: at } },
    );
  };
  const openMenu = (button: HTMLElement) => {
    close(false);
    const row = itemOf(button);
    if (!row) return;
    const label = button.getAttribute('aria-label')!.replace(/^Actions for /, '');
    const optional = row.dataset.aflStructure === 'optional';
    const menu = document.createElement('div');
    menu.className = 'afl-row-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Actions for ${label}`);
    const entries: [string, string, FillCommand][] = optional
      ? [['Remove', `Remove ${label}`, { kind: 'removeOptional', path: row.dataset.aflNode! }]]
      : [
          [
            'Insert above',
            `Insert a row above ${label}`,
            {
              kind: 'insertRow',
              groupId: row.dataset.aflGroup!,
              at: { row: row.dataset.aflNode!, where: 'before' },
            },
          ],
          [
            'Insert below',
            `Insert a row below ${label}`,
            {
              kind: 'insertRow',
              groupId: row.dataset.aflGroup!,
              at: { row: row.dataset.aflNode!, where: 'after' },
            },
          ],
          ['Remove', `Remove ${label}`, { kind: 'removeRow', path: row.dataset.aflNode! }],
        ];
    for (const [text, aria, command] of entries) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = -1;
      b.textContent = text;
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', () => {
        close(false);
        send(command);
      });
      menu.append(b);
    }
    button.after(menu);
    button.setAttribute('aria-expanded', 'true');
    open = { menu, button };
    (menu.firstElementChild as HTMLElement).focus();
  };
  const onClick = (e: Event) => {
    const t = e.target as Element;
    const button = t.closest<HTMLElement>('[data-afl-row-menu]');
    if (button) {
      e.preventDefault();
      return open?.button === button ? close(true) : openMenu(button);
    }
    if (open && !open.menu.contains(t)) close(false);
    const insert = t.closest<HTMLElement>('[data-afl-structure="insert"]');
    if (insert) insertAt(insert);
  };
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (open && open.menu.contains(t)) {
      const items = [...open.menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      const i = items.indexOf(t);
      const move = (n: number) => items[(n + items.length) % items.length]!.focus();
      if (e.key === 'ArrowDown') move(i + 1);
      else if (e.key === 'ArrowUp') move(i - 1);
      else if (e.key === 'Home') move(0);
      else if (e.key === 'End') move(items.length - 1);
      else if (e.key === 'Escape') close(true);
      else if (e.key === 'Tab') close(false);
      else return;
      if (e.key !== 'Tab') e.preventDefault();
      return;
    }
    if (t.dataset.aflRowMenu !== undefined && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openMenu(t);
    } else if (t.dataset.aflStructure === 'insert' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      insertAt(t);
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey as EventListener);
  return () => {
    close(false);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey as EventListener);
  };
}

/** The row button and menu, drawn inside the paper; hidden in print. */
export const ROWS_CSS = `
.afl-root .afl-row-host { position: relative; }
.afl-root .afl-row-button { position: absolute; top: 1px; right: 1px; min-width: 20px; height: 18px;
  padding: 0 3px; border: 1px solid #a5a5a5; border-radius: 3px; background: #fff; color: #172b4d;
  font: 12px/14px sans-serif; cursor: pointer; opacity: 0.55; }
.afl-root .afl-row-host:hover > .afl-row-button, .afl-root .afl-row-button:focus,
.afl-root .afl-row-button[aria-expanded='true'] { opacity: 1; }
.afl-root .afl-row-button:focus { outline: 2px solid #0c66e4; outline-offset: 1px; }
.afl-root .afl-row-menu { position: absolute; z-index: 2; top: 20px; right: 1px; display: flex;
  flex-direction: column; min-width: 120px; padding: 4px 0; border: 1px solid #a5a5a5;
  border-radius: 3px; background: #fff; box-shadow: 0 2px 6px rgb(0 0 0 / 0.2); }
.afl-root .afl-row-menu button { padding: 4px 10px; border: 0; background: none; color: #172b4d;
  font: 13px sans-serif; text-align: left; cursor: pointer; }
.afl-root .afl-row-menu button:hover, .afl-root .afl-row-menu button:focus { background: #e9f2ff;
  outline: none; }
.afl-root [data-afl-structure='insert'] { cursor: pointer; }
.afl-root [data-afl-structure='insert']:focus { outline: 2px solid #0c66e4; outline-offset: 1px; }
@media print { .afl-root .afl-row-button, .afl-root .afl-row-menu { display: none; } }
`;
