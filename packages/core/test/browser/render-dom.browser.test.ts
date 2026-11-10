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
