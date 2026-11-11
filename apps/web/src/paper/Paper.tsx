// Spec 09 D2, design §5: the paper. The render goes into a shadow root on a host that resets
// every inherited property, so neither the page's CSS nor its colour scheme reaches the form.
// Core has sanitised the HTML in the Worker (spec 03 P5); the root it returns is `inert`.
// X-ray (R5): outlines over the controls, from their measured boxes.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FillCommand, FilledRes, RenderedRes } from '../worker/protocol';
import { FILL_CSS, focusState, listen, restoreFocus, upgrade } from './fill';
import { focusItem, listenRows, ROWS_CSS, upgradeRows } from './rows';
import { loadPaperFonts } from '../shell/fonts';
import { fadeIn } from './fade';
import { hitTest, measure, toFrame, type Box } from './geometry';
import './paper.css';

/** 180 mm in CSS pixels: the narrower of A4 and Letter inside the 15 mm print margins. */
const PRINT_WIDTH = (180 / 25.4) * 96;

interface Props {
  readonly result: Pick<RenderedRes, 'html' | 'css'>;
  /** Spec 04: Fill mode. `result` is then this answer; edits go to `onCommand`. */
  readonly fill?: { readonly res: FilledRes; readonly onCommand: (c: FillCommand) => void };
  /** Accessible name of the paper region, e.g. "Expense Report, Claim view, empty form". */
  readonly label: string;
  readonly xray?: boolean;
  /** Controls to outline, by mark index. */
  readonly outlined?: readonly number[];
  /** Bring this control into view when it changes. */
  readonly reveal?: number;
  readonly onPoint?: (index: number | undefined) => void;
  /** The first render of this template: fade from sepia (R9.3). */
  readonly fade?: boolean;
  /** The paper's text after each render, field values included (design D7's font note). */
  readonly onText?: (text: string) => void;
}

export function Paper({
  result,
  label,
  xray = false,
  outlined = [],
  reveal,
  onPoint,
  onText,
  fade = false,
  fill,
}: Props) {
  const fillRef = useRef(fill);
  fillRef.current = fill;
  /** The group of the last row command sent, for focus when its last row is removed. */
  const rowGroup = useRef<string>();
  const frame = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const pending = useRef(0);

  const remeasure = useCallback(() => {
    cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => {
      const root = host.current?.shadowRoot;
      if (frame.current && root) setBoxes(measure(frame.current, root));
    });
  }, []);

  useLayoutEffect(() => {
    const el = host.current!;
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
    // Spec 04 R6.3: focus, caret and scroll survive the render that follows a commit.
    const f = fillRef.current;
    const focus = f ? focusState(root) : undefined;
    const scroll = frame.current && [
      frame.current.scrollTop,
      frame.current.scrollLeft,
      scrollX,
      scrollY,
    ];
    root.innerHTML = `<style>${result.css}${f ? FILL_CSS + ROWS_CSS : ''}</style>${result.html}`;
    if (f) {
      // e2e and R2.4: how many fill renders this paper has drawn.
      el.dataset.aflRenders = String(Number(el.dataset.aflRenders ?? 0) + 1);
      upgrade(root, f.res);
      upgradeRows(root, f.res);
      // After an insert or remove, focus goes to the new row or the one that took its place.
      const moved = focusItem(root, f.res, rowGroup.current);
      rowGroup.current = undefined;
      if (!moved && focus) restoreFocus(root, focus);
      if (scroll && frame.current) {
        [frame.current.scrollTop, frame.current.scrollLeft] = [scroll[0]!, scroll[1]!];
        if (scrollX !== scroll[2] || scrollY !== scroll[3]) window.scrollTo(scroll[2]!, scroll[3]!);
      }
    }
    if (fade) fadeIn(el);
    remeasure();
    if (onText) {
      const values = [...root.querySelectorAll('input, textarea')].map(
        (e) => (e as HTMLInputElement).value,
      );
      onText([root.querySelector('.afl-root')?.textContent ?? '', ...values].join(' '));
    }
    // `fade` comes with the result it belongs to; it is not a dependency on its own.
  }, [result, remeasure, onText]);

  const filling = fill !== undefined;
  useEffect(() => {
    const root = host.current?.shadowRoot;
    if (!filling || !root) return;
    const send = (c: FillCommand) => {
      if (c.kind === 'removeRow' || c.kind === 'removeOptional')
        rowGroup.current = root.querySelector<HTMLElement>(
          `[data-afl-node="${CSS.escape(c.path)}"]`,
        )?.dataset.aflGroup;
      fillRef.current?.onCommand(c);
    };
    const stop = listen(root, () => fillRef.current?.res, send);
    const stopRows = listenRows(root, send);
    return () => {
      stop();
      stopRows();
    };
  }, [filling]);

  useEffect(() => {
    void loadPaperFonts();
    const ro = new ResizeObserver(remeasure);
    ro.observe(host.current!);
    ro.observe(frame.current!);
    document.fonts.addEventListener('loadingdone', remeasure);
    return () => {
      ro.disconnect();
      document.fonts.removeEventListener('loadingdone', remeasure);
      cancelAnimationFrame(pending.current);
    };
  }, [remeasure]);

  // Spec 13 B1: before printing, the paper's zoom that fits its drawn width into the page.
  useEffect(() => {
    const fit = () => {
      const el = host.current;
      if (!el) return;
      el.style.minWidth = '0';
      const width = el.offsetWidth;
      el.style.minWidth = '';
      el.style.setProperty('--afl-print-zoom', String(Math.min(1, PRINT_WIDTH / width)));
    };
    window.addEventListener('beforeprint', fit);
    return () => window.removeEventListener('beforeprint', fit);
  }, []);

  useEffect(() => {
    const b = boxes.find((x) => x.index === reveal);
    const f = frame.current;
    if (!b || !f) return;
    const visible =
      b.y >= f.scrollTop &&
      b.y + b.h <= f.scrollTop + f.clientHeight &&
      b.x >= f.scrollLeft &&
      b.x + b.w <= f.scrollLeft + f.clientWidth;
    if (!visible) f.scrollTo({ top: Math.max(0, b.y - 48), left: Math.max(0, b.x - 48) });
    const rect = f.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) f.scrollIntoView({ block: 'nearest' });
  }, [reveal, boxes]);

  const frameRaf = useRef(0);
  const onMove = (e: React.PointerEvent) => {
    if (!xray || !onPoint) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frameRaf.current);
    frameRaf.current = requestAnimationFrame(() => {
      if (!frame.current) return;
      const p = toFrame(frame.current, clientX, clientY);
      onPoint(hitTest(boxes, p.x, p.y));
    });
  };

  const shown = xray ? boxes.filter((b) => outlined.includes(b.index)) : [];
  return (
    <section
      className={`afl-paper-frame${xray ? ' afl-xray' : ''}`}
      aria-label={label}
      ref={frame}
      onPointerMove={onMove}
      onPointerLeave={() => xray && onPoint?.(undefined)}
    >
      <div
        className="afl-paper-host"
        ref={host}
        data-afl-paper=""
        {...(fill && { 'data-afl-filling': '', 'data-afl-cycle-ms': fill.res.ms.toFixed(2) })}
      />
      <div className="afl-outlines" aria-hidden="true">
        {shown.map((b) => (
          <div
            key={b.index}
            className="afl-outline"
            data-index={b.index}
            style={{ left: b.x - 3, top: b.y - 3, width: b.w + 6, height: b.h + 6 }}
          />
        ))}
      </div>
    </section>
  );
}
