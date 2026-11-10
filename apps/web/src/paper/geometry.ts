// Spec 09 R5.3, design §5: X-ray geometry. The paper root is `inert`, so the paper gives no
// pointer events of its own; we keep the boxes of its `[data-afl-ctrl]` elements and hit-test
// them. Coordinates are relative to the frame's padding box, in its scrolled content, so a box
// and an outline drawn at it move with the content and scrolling needs no listener.

/** `index`: the element's position among `[data-afl-ctrl]` in document order, = its mark. */
export interface Box {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A client point in frame coordinates. */
export function toFrame(frame: HTMLElement, clientX: number, clientY: number) {
  const f = frame.getBoundingClientRect();
  return {
    x: clientX - f.left - frame.clientLeft + frame.scrollLeft,
    y: clientY - f.top - frame.clientTop + frame.scrollTop,
  };
}

export const controlsOf = (root: ParentNode) => [
  ...root.querySelectorAll<HTMLElement>('[data-afl-ctrl]'),
];

/** Boxes of every displayed control; hidden ones (zero size) are left out. */
export function measure(frame: HTMLElement, root: ParentNode): Box[] {
  const boxes: Box[] = [];
  controlsOf(root).forEach((el, index) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const { x, y } = toFrame(frame, r.left, r.top);
    boxes.push({ index, x, y, w: r.width, h: r.height });
  });
  return boxes;
}

/** The innermost control at a point: the smallest box that holds it. */
export function hitTest(boxes: readonly Box[], x: number, y: number): number | undefined {
  let best: Box | undefined;
  for (const b of boxes)
    if (
      x >= b.x &&
      x < b.x + b.w &&
      y >= b.y &&
      y < b.y + b.h &&
      (!best || b.w * b.h < best.w * best.h)
    )
      best = b;
  return best?.index;
}
