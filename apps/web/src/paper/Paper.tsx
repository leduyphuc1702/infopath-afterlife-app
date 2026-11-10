// Spec 09 D2, design §5: the paper. The render goes into a shadow root on a host that resets
// every inherited property, so neither the page's CSS nor its colour scheme reaches the form.
// Core has sanitised the HTML in the Worker (spec 03 P5); the root it returns is `inert`.
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RenderedRes } from '../worker/protocol';
import { loadPaperFonts } from '../shell/fonts';
import './paper.css';

interface Props {
  readonly result: RenderedRes;
  /** Accessible name of the paper region, e.g. "Expense report, Claim view, empty form". */
  readonly label: string;
}

export function Paper({ result, label }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = host.current!;
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${result.css}</style>${result.html}`;
  }, [result]);

  useEffect(() => {
    void loadPaperFonts();
  }, []);

  return (
    <section className="afl-paper-frame" aria-label={label}>
      <div className="afl-paper-host" ref={host} data-afl-paper="" />
    </section>
  );
}
