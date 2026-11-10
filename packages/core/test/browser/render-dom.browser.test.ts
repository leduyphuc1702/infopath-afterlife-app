/// <reference types="vite/client" />
import { commands, userEvent } from 'vitest/browser';
import { beforeAll, expect, test } from 'vitest';
import { buildFormIR, parseXsn, prepareView, renderView, type RenderResult } from '../../src/index';
import { GOLDEN_INPUT } from '../helpers/render-golden';

// Spec 03 task 4 (R5.4, R5.5, R6.6), form 01 only for now (task 8 extends to forms 01–08): the
// render inside a real page is inert, its styles stay inside the root, and the four asterisks
// sit inside the right edge of their controls.

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
const cabinet = (await commands.sampleCabinets()).find((c) => c.slug === '01-leave-request')!;
const recordPath = (n: string) =>
  `${cabinet.formsDir!.replace('/forms/', '/records/')}01-leave-request-${n}.xml`;

let result: RenderResult;
let root: HTMLElement;
let outsideBefore: Map<string, string>;

const OUTSIDE =
  '<table id="o-table"><tbody><tr><td id="o-td"><span id="o-span" class="xdTextBox">outside</span></td></tr></tbody></table>';
const styleOf = (el: Element) => {
  const cs = getComputedStyle(el);
  return Array.from(cs, (p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
};
const outsideStyles = () =>
  new Map(
    ['body', '#o-table', '#o-td', '#o-span'].map((s) => [s, styleOf(document.querySelector(s)!)]),
  );

beforeAll(async () => {
  const t = await parseXsn(fromBase64(await commands.readFile(cabinet.path, 'base64')));
  const record = fromBase64(await commands.readFile(recordPath('000-empty'), 'base64'));
  result = renderView(await prepareView(t, buildFormIR(t)), { ...GOLDEN_INPUT, record });

  document.body.innerHTML = OUTSIDE;
  outsideBefore = outsideStyles();
  const style = document.createElement('style');
  style.textContent = result.css;
  document.head.append(style);
  const host = document.createElement('div');
  host.innerHTML = result.html;
  document.body.append(host);
  root = host.querySelector<HTMLElement>('.afl-root')!;
});

test('no element inside the root takes focus, and typing changes nothing (R5.4)', async () => {
  const all = [root, ...root.querySelectorAll<HTMLElement>('*')];
  expect(all.length).toBeGreaterThan(50);
  expect(
    root.querySelectorAll('[tabindex],[contenteditable],[autofocus],[accesskey]'),
  ).toHaveLength(0);
  const before = root.innerHTML;
  const values = [...root.querySelectorAll('input,select,textarea')].map(
    (e) => (e as HTMLInputElement).value,
  );
  for (const el of all) {
    el.focus();
    expect(document.activeElement, el.outerHTML.slice(0, 80)).not.toBe(el);
    expect(el.isContentEditable).toBe(false);
    await userEvent.keyboard('typed');
  }
  await userEvent.keyboard('{Tab}{Tab}{Tab}more{Enter} ');
  expect(root.contains(document.activeElement)).toBe(false);
  expect(root.innerHTML).toBe(before);
  expect(
    [...root.querySelectorAll('input,select,textarea')].map((e) => (e as HTMLInputElement).value),
  ).toEqual(values);
});

test('elements outside the root keep their computed style (R5.5)', () => {
  // The view sets BODY{margin-left:21px;…} and .xdTextBox{border:…}; neither may reach the page.
  expect(getComputedStyle(root).marginLeft).toBe('21px');
  expect(getComputedStyle(root.querySelector('.xdTextBox')!).borderTopStyle).toBe('solid');
  const after = outsideStyles();
  for (const [sel, style] of outsideBefore) expect(after.get(sel), sel).toBe(style);
});

test('the four asterisks sit inside the right edge of their controls, vertically centred (R6.6)', () => {
  const marked = [...root.querySelectorAll<HTMLElement>('.afl-required')];
  expect(marked.map((e) => e.dataset.aflPath)).toEqual([
    '/my:leaveRequest[1]/my:employeeName[1]',
    '/my:leaveRequest[1]/my:employeeId[1]',
    '/my:leaveRequest[1]/my:startDate[1]',
    '/my:leaveRequest[1]/my:endDate[1]',
  ]);
  for (const el of marked) {
    const box = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const star = getComputedStyle(el, '::after');
    expect(cs.position).toBe('relative');
    expect(star.content).toBe('"*"');
    expect(star.color).toBe('rgb(255, 0, 0)');
    expect(star.position).toBe('absolute');
    // The pseudo-element's box, from its used values: right 3px, 8×8, centred on the middle.
    const width = parseFloat(star.width);
    const height = parseFloat(star.height);
    const right = parseFloat(star.right);
    expect([width, height, right]).toEqual([8, 8, 3]);
    expect(parseFloat(star.marginTop)).toBe(-height / 2);
    // top: 50% of the padding box, which for an inline span is its line box, not clientHeight.
    const padding = box.height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
    expect(parseFloat(star.top)).toBeCloseTo(padding / 2, 0);
    // Inside the right edge: the control is wider and taller than the mark and its inset.
    expect(box.width).toBeGreaterThan(width + right);
    expect(box.height).toBeGreaterThan(height);
    // No border change: the same border as an unmarked control of the same class.
    const peer = root.querySelector(`.${el.classList[0]}:not(.afl-required)`)!;
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      const prop = `border${side}Color` as const;
      expect(cs[prop]).toBe(getComputedStyle(peer)[prop]);
      expect(cs[`border${side}Width`]).toBe(getComputedStyle(peer)[`border${side}Width`]);
    }
  }
});

// --- Task 8 (R5.4 on forms 01–08, R6.3, the date-picker layout) -------------------------------

const cabinets = (await commands.sampleCabinets()).filter((c) => /^0[1-8]-/.test(c.slug));

/** Renders a cabinet's default view with a record into a new host on the page. */
async function mount(slug: string, record: 'empty' | 'first'): Promise<HTMLElement> {
  const c = cabinets.find((x) => x.slug === slug)!;
  const t = await parseXsn(fromBase64(await commands.readFile(c.path, 'base64')));
  const recordFile = `${c.formsDir!.replace('/forms/', '/records/')}${slug}-${record === 'empty' ? '000-empty' : '001'}.xml`;
  const r = renderView(await prepareView(t, buildFormIR(t)), {
    ...GOLDEN_INPUT,
    record: fromBase64(await commands.readFile(recordFile, 'base64')),
  });
  const host = document.createElement('div');
  host.innerHTML = `<style>${r.css}</style>${r.html}`;
  document.body.append(host);
  return host.querySelector<HTMLElement>('.afl-root')!;
}

test('forms 01–08 are covered', () => {
  expect(cabinets.map((c) => c.slug.slice(0, 2))).toEqual([
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
  ]);
});

test.each(cabinets.flatMap((c) => [[c.slug, 'empty'] as const, [c.slug, 'first'] as const]))(
  '%s %s record: no element inside the root takes focus (R5.4)',
  async (slug, record) => {
    const r = await mount(slug, record);
    expect(r.querySelectorAll('[tabindex],[contenteditable],[autofocus],[accesskey]')).toHaveLength(
      0,
    );
    for (const el of [r, ...r.querySelectorAll<HTMLElement>('*')]) {
      el.focus();
      expect(document.activeElement, el.outerHTML.slice(0, 80)).not.toBe(el);
    }
    r.parentElement!.remove();
  },
);

test("form 01's empty PlainText controls are each at least one line high (R6.3)", async () => {
  const r = await mount('01-leave-request', 'empty');
  const boxes = [...r.querySelectorAll<HTMLElement>('[data-afl-ctrl]')].filter(
    (e) => e.getAttribute('xd:xctname') === 'PlainText',
  );
  expect(boxes.length).toBe(5);
  for (const el of boxes) {
    expect(el.textContent).toBe('');
    // One line of the control's own font: an inline-block probe holding one character.
    const probe = document.createElement('span');
    probe.style.display = 'inline-block';
    probe.textContent = 'X';
    el.parentElement!.append(probe);
    const line = probe.getBoundingClientRect().height;
    probe.remove();
    expect(el.clientHeight, el.title).toBeGreaterThanOrEqual(line - 0.5);
  }
  r.parentElement!.remove();
});

test.each([
  ['01-leave-request', 'empty', 3],
  ['01-leave-request', 'first', 3],
  ['02-expense-report', 'empty', 0],
  ['02-expense-report', 'first', 2],
] as const)(
  '%s %s record: each date picker is one line inside its cell, button at the right edge',
  async (slug, record, count) => {
    const r = await mount(slug, record);
    const pickers = [...r.querySelectorAll<HTMLElement>('.xdDTPicker')];
    expect(pickers).toHaveLength(count);
    for (const p of pickers) {
      const text = p.querySelector('.xdDTText')!.getBoundingClientRect();
      const button = p.querySelector('.xdDTButton')!;
      const btn = button.getBoundingClientRect();
      const box = p.getBoundingClientRect();
      const cell = p.closest('td')!.getBoundingClientRect();
      const cs = getComputedStyle(p);
      // One line: the text and the button share a vertical range, text first.
      expect(text.top, p.title).toBeLessThan(btn.bottom);
      expect(btn.top, p.title).toBeLessThan(text.bottom);
      expect(text.right, p.title).toBeLessThanOrEqual(btn.left + 0.5);
      // Inside the cell.
      expect(box.left, p.title).toBeGreaterThanOrEqual(cell.left - 0.5);
      expect(box.right, p.title).toBeLessThanOrEqual(cell.right + 0.5);
      // The button at the right edge, holding our calendar icon.
      expect(btn.right, p.title).toBeCloseTo(box.right - parseFloat(cs.borderRightWidth), 0);
      const icon = button.querySelector('.afl-icon-calendar')!.getBoundingClientRect();
      expect([icon.width, icon.height]).toEqual([16, 16]);
    }
    r.parentElement!.remove();
  },
);

// Task 14 review (design §8.1 step 9, quirks box model): every rendered control lies inside its
// nearest cell, as in InfoPath, where `width` includes padding and border. Tolerance 0.5 px.
test.each(cabinets.flatMap((c) => [[c.slug, 'empty'] as const, [c.slug, 'first'] as const]))(
  '%s %s record: every control box lies inside its nearest td',
  async (slug, record) => {
    const r = await mount(slug, record);
    const controls = [...r.querySelectorAll<HTMLElement>('[data-afl-ctrl]')];
    expect(controls.length).toBeGreaterThan(0);
    const outside: string[] = [];
    for (const el of controls) {
      const td = el.closest('td');
      if (td === null) continue;
      const a = el.getBoundingClientRect();
      if (a.width === 0 && a.height === 0) continue; // not displayed (a hidden section)
      const b = td.getBoundingClientRect();
      const d = [b.left - a.left, a.right - b.right, b.top - a.top, a.bottom - b.bottom];
      if (d.some((x) => x > 0.5))
        outside.push(`${el.title || el.className}: ${d.map((x) => x.toFixed(1)).join(' ')}`);
    }
    expect(outside).toEqual([]);
    r.parentElement!.remove();
  },
);

// Spec 09 preamble (design §8.1 step 9): a first `p` in a control or a cell has no top margin.
// Form 06's "What happened" rich text box holds `<div><p>…</p></div>`; InfoPath draws the text at
// the top of the box (`06-safety-incident-Report-filled.png`) [seen].
test("form 06's rich text starts at the top of its box; a cell's first p has no top margin", async () => {
  const r = await mount('06-safety-incident', 'first');
  const box = r.querySelector<HTMLElement>(
    '[data-afl-path="/my:incidentReport[1]/my:incidentDescription[1]"]',
  )!;
  const p = box.querySelector('p')!;
  expect(p.textContent).toMatch(/^Incident at 20:54\./);
  expect(getComputedStyle(p).marginTop).toBe('0px');
  const cs = getComputedStyle(box);
  const inset = parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
  expect(p.getBoundingClientRect().top - box.getBoundingClientRect().top).toBeCloseTo(inset, 0);
  // A cell, directly and through InfoPath's wrapping div; a second p keeps its margin.
  const cell = document.createElement('table');
  cell.innerHTML =
    '<tbody><tr><td><p id="c1">a</p><p id="c2">b</p></td><td><div><p id="c3">c</p></div></td></tr></tbody>';
  r.append(cell);
  expect(getComputedStyle(cell.querySelector('#c1')!).marginTop).toBe('0px');
  expect(getComputedStyle(cell.querySelector('#c3')!).marginTop).toBe('0px');
  expect(getComputedStyle(cell.querySelector('#c2')!).marginTop).not.toBe('0px');
  r.parentElement!.remove();
});
