import { buildFormIR, parseXsn, prepareView, renderView, type RenderResult } from '@afterlife/core';
import { afterEach, describe, expect, test } from 'vitest';
import files from 'virtual:sample-files';
import { controlsOf, hitTest, measure } from '../src/paper/geometry';

// Spec 09 R5.3 and design §5's two [VERIFY] items: the i-th [data-afl-ctrl] element is marks[i]
// (forms 01–08, empty form and first record); pointing at the inert paper reaches the frame, not
// the control; boxes stay within 1 px of their controls after scrolling and resizing (form 08).

const NOW = '2026-11-10T21:24:10+07:00';
const SLUGS = Object.keys(files)
  .filter((k) => /^0[1-8]-/.test(k))
  .sort();
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function renderSample(slug: string, first: boolean): Promise<RenderResult> {
  const s = files[slug]!;
  const t = await parseXsn(b64(s.template[1]));
  const ir = buildFormIR(t);
  const record = first ? new TextEncoder().encode(s.records[0]![1]) : undefined;
  return renderView(await prepareView(t, ir), {
    now: NOW,
    locale: 'en-US',
    ...(record && { record }),
  });
}

function mount(r: RenderResult, width = 600, height = 300) {
  const frame = document.createElement('section');
  frame.style.cssText = `position:relative;overflow:auto;width:${width}px;height:${height}px;padding:16px;border:3px solid #ccc`;
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;display:flow-root;width:max-content;min-width:100%';
  frame.append(host);
  document.body.append(frame);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${r.css}</style>${r.html}`;
  return { frame, root };
}

afterEach(() => {
  document.body.innerHTML = '';
});

test('forms 01–08 are covered', () => {
  expect(SLUGS).toHaveLength(8);
});

describe.each(SLUGS.flatMap((s) => [[s, false] as const, [s, true] as const]))(
  '%s, first record %s',
  (slug, first) => {
    test('the i-th [data-afl-ctrl] element is marks[i]', async () => {
      const r = await renderSample(slug, first);
      const { root } = mount(r);
      const els = controlsOf(root);
      expect(els.length).toBe(r.marks.length);
      els.forEach((el, i) => {
        expect(el.dataset.aflCtrl, `${i}`).toBe(r.marks[i]!.controlId);
        expect(el.dataset.aflPath, `${i}`).toBe(r.marks[i]!.path);
      });
    });
  },
);

test('form 08: boxes follow scrolling and resizing within 1 px; the paper is not hit-testable', async () => {
  const r = await renderSample('08-big-form', true);
  const { frame, root } = mount(r);
  const check = () => {
    const boxes = measure(frame, root);
    expect(boxes.length).toBeGreaterThan(200);
    const els = controlsOf(root);
    const f = frame.getBoundingClientRect();
    for (const b of boxes) {
      const e = els[b.index]!.getBoundingClientRect();
      // Where an outline at (b.x, b.y) inside the frame is drawn now.
      const left = f.left + frame.clientLeft + b.x - frame.scrollLeft;
      const top = f.top + frame.clientTop + b.y - frame.scrollTop;
      expect(Math.abs(left - e.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(top - e.top)).toBeLessThanOrEqual(1);
    }
    return boxes;
  };
  const before = check();
  // Scrolled after measuring: the same boxes, drawn in content coordinates, still fit.
  frame.scrollTo(80, 900);
  expect(frame.scrollTop).toBeGreaterThan(0);
  const f = frame.getBoundingClientRect();
  const els = controlsOf(root);
  for (const b of before) {
    const e = els[b.index]!.getBoundingClientRect();
    expect(
      Math.abs(f.left + frame.clientLeft + b.x - frame.scrollLeft - e.left),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(f.top + frame.clientTop + b.y - frame.scrollTop - e.top)).toBeLessThanOrEqual(
      1,
    );
  }
  // Resized: measured again, the boxes fit again.
  frame.style.width = '400px';
  check();

  // [VERIFY] inert: a point inside a visible control hits neither it nor anything in the root,
  // so pointer events land on the frame; hitTest still finds the control from its box.
  const boxes = measure(frame, root);
  const visible = boxes.find(
    (b) => b.y > frame.scrollTop + 20 && b.y + b.h < frame.scrollTop + frame.clientHeight - 20,
  )!;
  const e = els[visible.index]!.getBoundingClientRect();
  const cx = e.left + e.width / 2;
  const cy = e.top + e.height / 2;
  const paperRoot = root.querySelector('.afl-root')!;
  expect(paperRoot.hasAttribute('inert')).toBe(true);
  const hit = root.elementFromPoint(cx, cy);
  expect(hit === null || !paperRoot.contains(hit)).toBe(true);
  const docHit = document.elementFromPoint(cx, cy);
  expect(docHit === root.host || docHit === frame).toBe(true);
  const fr = frame.getBoundingClientRect();
  expect(
    hitTest(
      boxes,
      cx - fr.left - frame.clientLeft + frame.scrollLeft,
      cy - fr.top - frame.clientTop + frame.scrollTop,
    ),
  ).toBe(visible.index);
});
