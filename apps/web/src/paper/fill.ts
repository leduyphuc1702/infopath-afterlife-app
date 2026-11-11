// Spec 04 R6, design D21–D23: editing on the paper. Core's render stays as it is; after each
// render the page removes `inert`, makes the controls it can edit editable, marks the ones it
// cannot, draws invalid fields, and puts focus and caret back. It never inserts HTML.
import type { FillCommand, FilledRes, PaperFocus } from '../worker/protocol';

/** `xd:xctname` values edited in place (R6.1). Everything else is read-only (R6.2). */
const TEXT = new Set(['PlainText', 'DTPicker_DTText', 'RichText']);
const CHOICE = new Set(['dropdown', 'ListBox', 'CheckBox', 'OptionButton']);
export const CANT_EDIT = "This control can't be edited in the viewer.";
export const WORKED_OUT = 'Worked out from other fields, so it is not typed in.';

/** Short Date (en-US, the corpus's date patterns) → ISO; anything else is kept as typed. */
export function dateValue(text: string): string {
  const t = text.trim();
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) return `${us[3]}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`;
  return t;
}

const xct = (el: Element) => el.getAttribute('xd:xctname') ?? '';
const pathOf = (el: Element) => (el as HTMLElement).dataset.aflPath;
const isText = (el: Element) =>
  TEXT.has(xct(el)) && (el as HTMLElement).dataset.aflEdit !== undefined;

/** The item node of the repeating row an element is in, if any (R4.4: a button's context). */
const rowOf = (el: Element) =>
  el.closest<HTMLElement>('[data-afl-structure="row"], [data-afl-structure="optional"]')?.dataset
    .aflNode;

/**
 * Spec 23 B2: the field being typed in whose text is not committed yet, inside the paper's shadow
 * root; undefined when there is none.
 */
export function uncommitted(): HTMLElement | undefined {
  let a = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  const el = a?.closest?.<HTMLElement>('[data-afl-ctrl]');
  if (!el || el.dataset.aflRaw === undefined) return undefined;
  const text = el.textContent ?? '';
  return text !== el.dataset.aflRaw && text !== el.dataset.aflSent ? el : undefined;
}

/** The text node and offset `at` characters into `el`'s text; `el` itself when it has none. */
function caretPoint(el: HTMLElement, at: number): { node: Node; offset: number } {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last: Text | undefined;
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    if (at <= n.length) return { node: n, offset: at };
    at -= n.length;
    last = n;
  }
  return last ? { node: last, offset: last.length } : { node: el, offset: el.childNodes.length };
}

/** Spec 24 W4: `xdXDocument:GetDOM("ItemMetadata")/…` → "ItemMetadata". */
const otherSource = (el: Element) =>
  /GetDOM\(\s*["']([^"']*)["']\s*\)/.exec(el.getAttribute('xd:binding') ?? '')?.[1];
const FROM_SOURCE = (name: string) =>
  `Shows a value from the data connection “${name}”, which is not part of the record, so it can’t be changed here.`;
export const RICH_WORDS = (label: string) =>
  `Typing in ${label} keeps the words, not the formatting (bold, lists, links).`;

/** Spec 23 B4: "my:neededBy" → "Needed by", for a control InfoPath gave no title. */
const nameOfBinding = (el: Element) => {
  const last = (el.getAttribute('xd:binding') ?? '').split(/[/:@]/).pop() ?? '';
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return words ? words[0]!.toUpperCase() + words.slice(1).toLowerCase() : undefined;
};

/** The date box a calendar button belongs to. */
const dateBoxOf = (b: Element) =>
  b.closest('.xdDTPicker')?.querySelector<HTMLElement>('[data-afl-ctrl]') ?? undefined;

/** Upgrades the controls of a fresh render (R6.1, R6.2, R5.2). */
export function upgrade(root: ShadowRoot, res: FilledRes): void {
  root.querySelector('.afl-root')?.removeAttribute('inert');
  // R4.4: buttons in the view run their rules in Fill mode.
  for (const b of root.querySelectorAll<HTMLInputElement>('input[type="button"]')) {
    const ctrl = b.getAttribute('xd:ctrlid');
    if (ctrl !== null) b.dataset.aflButton = ctrl;
  }
  const calculated = new Set(res.calculated);
  for (const el of root.querySelectorAll<HTMLElement>('[data-afl-ctrl]')) {
    const kind = xct(el);
    const path = pathOf(el);
    // Spec 24 X4: an empty title is no name either.
    const label = el.getAttribute('title') || nameOfBinding(el);
    if (label !== undefined) el.setAttribute('aria-label', label);
    const source = otherSource(el);
    const readOnly =
      path === undefined ||
      source !== undefined ||
      !(TEXT.has(kind) || CHOICE.has(kind)) ||
      el.getAttribute('xd:disableediting') === 'yes';
    if (readOnly || calculated.has(path)) {
      // Inputs and selects stay as they look; their changes are refused in `listen`.
      el.dataset.aflReadonly = '';
      // Spec 24 X1, X3: `aria-readonly` only where the role has it; a box is a read-only text
      // box, anything else drawn as a `span` (attachment, picture) a named group.
      const own =
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLInputElement && el.type === 'checkbox');
      if (TEXT.has(kind) && !(el instanceof HTMLInputElement)) el.setAttribute('role', 'textbox');
      else if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement))
        el.setAttribute('role', 'group');
      if (TEXT.has(kind) || own) el.setAttribute('aria-readonly', 'true');
      for (const img of el.querySelectorAll('img:not([alt])')) img.setAttribute('alt', label ?? '');
      const why =
        source !== undefined
          ? FROM_SOURCE(source)
          : path !== undefined && calculated.has(path)
            ? WORKED_OUT
            : CANT_EDIT;
      el.setAttribute('aria-description', why);
      el.title = label ? `${label}. ${why}` : why;
      continue;
    }
    el.dataset.aflEdit = kind;
    const value = res.values[path] ?? '';
    if (TEXT.has(kind)) {
      el.contentEditable = 'plaintext-only';
      el.setAttribute('role', 'textbox');
      if (kind === 'RichText') {
        el.setAttribute('aria-multiline', 'true');
        // Spec 24 D1: typing here is plain text; formatting the record held is not kept.
        if (el.querySelector('*')) {
          const words = RICH_WORDS(label ?? 'this box');
          el.setAttribute('aria-description', words);
          el.title = words;
          el.dataset.aflFormatted = '';
        }
      }
      el.dataset.aflShown = el.textContent ?? '';
    } else if (el instanceof HTMLSelectElement) {
      el.value = value;
    } else if (el instanceof HTMLInputElement) {
      el.checked = value === (el.getAttribute('xd:onvalue') ?? 'true');
    }
  }
  // Spec 24 W2: the calendar button opens the browser's date picker for its box.
  for (const b of root.querySelectorAll<HTMLElement>('button.xdDTButton')) {
    const box = dateBoxOf(b);
    if (box?.dataset.aflEdit === undefined) {
      b.tabIndex = -1;
      b.setAttribute('aria-hidden', 'true');
      continue;
    }
    b.dataset.aflDate = '';
    b.setAttribute(
      'aria-label',
      `Choose a date for ${box.getAttribute('aria-label') ?? 'this box'}`,
    );
    b.title = b.getAttribute('aria-label')!;
  }
  for (const inv of res.invalid)
    for (const el of root.querySelectorAll<HTMLElement>(
      `[data-afl-path="${CSS.escape(inv.path)}"]`,
    )) {
      el.classList.add('afl-invalid');
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-description', inv.message);
      el.title = inv.short;
    }
}

/** What has focus in the paper, to put back after the next render (R6.3). */
export type FocusState = PaperFocus;

export function focusState(root: ShadowRoot): FocusState | undefined {
  const active = root.activeElement as HTMLElement | null;
  if (active?.dataset.aflButton !== undefined) {
    const row = rowOf(active);
    return {
      ctrl: '',
      path: undefined,
      button: { ctrl: active.dataset.aflButton, ...(row !== undefined && { row }) },
    };
  }
  if (active?.dataset.aflRowMenu !== undefined || active?.dataset.aflStructure === 'insert') {
    const item = active.closest<HTMLElement>('[data-afl-structure]')!;
    return {
      ctrl: '',
      path: undefined,
      structure: { node: item.dataset.aflNode ?? '', kind: item.dataset.aflStructure ?? '' },
    };
  }
  const el = active?.closest<HTMLElement>('[data-afl-ctrl]');
  if (!el) return undefined;
  const ctrl = el.dataset.aflCtrl!;
  const path = pathOf(el);
  if (!isText(el)) return { ctrl, path };
  const s = selection(root);
  const range = s?.rangeCount ? s.getRangeAt(0) : undefined;
  let caret: number | undefined;
  if (range && el.contains(range.startContainer)) {
    const before = document.createRange();
    before.selectNodeContents(el);
    before.setEnd(range.startContainer, range.startOffset);
    caret = before.toString().length;
  }
  const text = el.textContent ?? '';
  const edited = el.dataset.aflRaw !== undefined && text !== el.dataset.aflRaw;
  return { ctrl, path, ...(edited && { text }), ...(caret !== undefined && { caret }) };
}

/** Chrome gives a shadow root its own selection; elsewhere the document's is retargeted. */
const selection = (root: ShadowRoot): Selection | null =>
  (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ??
  document.getSelection();

export function restoreFocus(root: ShadowRoot, f: FocusState): void {
  if (f.button) {
    const all = root.querySelectorAll<HTMLElement>(
      `[data-afl-button="${CSS.escape(f.button.ctrl)}"]`,
    );
    [...all].find((b) => rowOf(b) === f.button!.row)?.focus({ preventScroll: true });
    return;
  }
  if (f.structure) {
    const item = root.querySelector<HTMLElement>(
      `[data-afl-structure="${CSS.escape(f.structure.kind)}"][data-afl-node="${CSS.escape(f.structure.node)}"]`,
    );
    const target =
      f.structure.kind === 'insert'
        ? item
        : item?.querySelector<HTMLElement>('[data-afl-row-menu]');
    target?.focus({ preventScroll: true });
    return;
  }
  const sel = `[data-afl-ctrl="${CSS.escape(f.ctrl)}"]${f.path === undefined ? '' : `[data-afl-path="${CSS.escape(f.path)}"]`}`;
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (!isText(el)) return;
  if (f.text !== undefined) el.textContent = f.text;
  const text = el.textContent ?? '';
  const at = Math.min(f.caret ?? text.length, text.length);
  const range = document.createRange();
  // Spec 24 W1: a rich text box holds elements (`<div><p>…</p></div>`), not one text node; the
  // caret goes at `at` characters into its text, whichever node that falls in.
  const point = caretPoint(el, at);
  range.setStart(point.node, point.offset);
  range.collapse(true);
  const s = selection(root);
  s?.removeAllRanges();
  s?.addRange(range);
}

/**
 * Listens on the paper's shadow root for edits; `current` gives the latest answer, `send` posts a
 * command. Returns the cleanup.
 */
export function listen(
  root: ShadowRoot,
  current: () => FilledRes | undefined,
  send: (c: FillCommand) => void,
): () => void {
  const control = (t: EventTarget | null) =>
    (t as Element | null)?.closest?.<HTMLElement>('[data-afl-ctrl]') ?? null;
  const commit = (el: HTMLElement) => {
    const path = pathOf(el);
    const raw = el.dataset.aflRaw;
    if (path === undefined || raw === undefined) return;
    let text = el.textContent ?? '';
    if (xct(el) === 'DTPicker_DTText') text = dateValue(text);
    else if (xct(el) !== 'RichText') text = text.replace(/\r?\n/g, ' ');
    if (text === raw || text === el.dataset.aflSent) return;
    el.dataset.aflSent = text;
    send({ kind: 'edit', path, value: text });
  };
  const onFocusIn = (e: Event) => {
    const el = control(e.target);
    // Spec 24 D1: said where it is seen, once per focus.
    if (el?.dataset.aflFormatted !== undefined && el.dataset.aflRaw === undefined)
      root.host.dispatchEvent(
        new CustomEvent('afl-note', {
          detail: RICH_WORDS(el.getAttribute('aria-label') ?? 'this box'),
          bubbles: true,
          composed: true,
        }),
      );
    if (!el || !isText(el) || el.dataset.aflRaw !== undefined) return;
    // The stored value while typing; the view's formatting when not (InfoPath does the same).
    const raw = current()?.values[pathOf(el)!] ?? '';
    el.dataset.aflRaw = raw;
    if (el.textContent !== raw) el.textContent = raw;
  };
  const onFocusOut = (e: Event) => {
    const el = control(e.target);
    if (!el || !isText(el)) return;
    commit(el);
    if (el.dataset.aflSent === undefined && el.dataset.aflShown !== undefined)
      el.textContent = el.dataset.aflShown;
    delete el.dataset.aflRaw;
  };
  const onKey = (e: KeyboardEvent) => {
    const el = control(e.target);
    // R10.1: Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z undo and redo whole commands. While a text box
    // holds typing that is not committed yet, the browser's own undo works on that typing.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
      e.stopPropagation();
      if (
        el &&
        isText(el) &&
        el.dataset.aflRaw !== undefined &&
        el.textContent !== el.dataset.aflRaw
      )
        return;
      e.preventDefault();
      send({ kind: e.shiftKey ? 'redo' : 'undo' });
      return;
    }
    if (!el || !isText(el)) return;
    const multi = xct(el) === 'RichText';
    if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit(el);
    } else if (e.key === 'Escape') {
      el.textContent = el.dataset.aflRaw ?? el.textContent;
    }
  };
  const onChange = (e: Event) => {
    const el = control(e.target);
    const path = el ? pathOf(el) : undefined;
    if (!el || path === undefined) return;
    if (el.dataset.aflReadonly !== undefined) return;
    if (el instanceof HTMLSelectElement) send({ kind: 'edit', path, value: el.value });
    else if (el instanceof HTMLInputElement && el.type === 'checkbox')
      send({
        kind: 'edit',
        path,
        value:
          (el.checked ? el.getAttribute('xd:onvalue') : el.getAttribute('xd:offvalue')) ??
          String(el.checked),
      });
    else if (el instanceof HTMLInputElement && el.type === 'radio' && el.checked)
      send({ kind: 'edit', path, value: el.getAttribute('xd:onvalue') ?? '' });
  };
  // Read-only inputs keep their look but refuse changes (R6.2).
  const onClick = (e: Event) => {
    const button = (e.target as Element | null)?.closest?.<HTMLElement>('[data-afl-button]');
    if (button) {
      const path = rowOf(button);
      send({
        kind: 'press',
        ctrlId: button.dataset.aflButton!,
        ...(path !== undefined && { path }),
      });
      return;
    }
    const pick = (e.target as Element | null)?.closest?.<HTMLElement>('[data-afl-date]');
    if (pick) return void openPicker(pick);
    const el = control(e.target);
    if (el?.dataset.aflReadonly !== undefined && el instanceof HTMLInputElement) e.preventDefault();
  };
  const openPicker = (b: HTMLElement) => {
    const box = dateBoxOf(b);
    const path = box && pathOf(box);
    if (!box || path === undefined) return;
    root.querySelector('input.afl-date-pick')?.remove();
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'afl-date-pick';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.value = current()?.values[path] ?? '';
    input.addEventListener('change', () => {
      if (input.value) send({ kind: 'edit', path, value: input.value });
      input.remove();
    });
    b.after(input);
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };
  const onBefore = (e: Event) => {
    const el = control(e.target);
    if (el?.dataset.aflReadonly !== undefined) e.preventDefault();
  };
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('keydown', onKey as EventListener);
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
  const onDown = (e: Event) => {
    const el = control(e.target);
    if (el?.dataset.aflReadonly !== undefined && el instanceof HTMLSelectElement)
      e.preventDefault();
  };
  root.addEventListener('mousedown', onDown);
  root.addEventListener('beforeinput', onBefore);
  return () => {
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('keydown', onKey as EventListener);
    root.removeEventListener('change', onChange);
    root.removeEventListener('click', onClick);
    root.removeEventListener('beforeinput', onBefore);
    root.removeEventListener('mousedown', onDown);
  };
}

/** Spec 04 task 11: outlines the field a Rule Trace entry is about, or none. */
export function traceOutline(root: ShadowRoot, path: string | undefined): void {
  for (const el of root.querySelectorAll('.afl-traced')) el.classList.remove('afl-traced');
  if (path === undefined) return;
  const els = root.querySelectorAll<HTMLElement>(`[data-afl-path="${CSS.escape(path)}"]`);
  for (const el of els) el.classList.add('afl-traced');
  els[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** Outside Fill mode the paper is inert; its buttons look it (spec 04 task 10). */
export const READ_CSS = `
.afl-root[inert] input[type='button'] { opacity: 0.5; filter: grayscale(1); cursor: default; }
`;

/** Spec 16 N3: InfoPath did not print its "Insert item" placeholders; read mode and Fill. */
export const PRINT_CSS = `
@media print { .afl-root [data-afl-structure='insert'] { display: none !important; } }
`;

/** Drawn inside the paper's shadow root in Fill mode: InfoPath's invalid border, focus rings. */
export const FILL_CSS = `
.afl-root .afl-date-pick { position: absolute; width: 1px; height: 1px; opacity: 0; border: 0; padding: 0; }
.afl-root .afl-traced { outline: 3px solid #6e5dc6 !important; outline-offset: 2px; }
.afl-root [data-afl-button] { cursor: pointer; }
.afl-root [data-afl-button]:focus { outline: 2px solid #0c66e4; outline-offset: 1px; }
.afl-root [data-afl-edit]:focus { outline: 2px solid #0c66e4; outline-offset: 1px; }
.afl-root [data-afl-edit][contenteditable] { cursor: text; }
.afl-root .afl-invalid { outline: 1px dashed #c9372c !important; outline-offset: 1px; }
.afl-root .afl-invalid:focus { outline: 2px dashed #c9372c !important; }
.afl-root [data-afl-readonly] { cursor: default; }
`;
