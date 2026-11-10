// Label probe shared by the Node test, the `nodeAcceptedLabels` browser command and the Worker.
// Browser-safe: JSON import and TextDecoder only.

import whatwg from '../fixtures/whatwg-encodings.json';

export interface WhatwgLabel {
  label: string;
  /** The encoding name in the WHATWG table, e.g. `UTF-8`, `replacement`. */
  name: string;
}

export const WHATWG_LABELS: WhatwgLabel[] = whatwg.flatMap((heading) =>
  heading.encodings.flatMap((e) => e.labels.map((label) => ({ label, name: e.name }))),
);

/** Label → canonical `TextDecoder#encoding`, or `null` where the constructor throws. */
export function probeLabels(labels: readonly string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const label of labels) {
    try {
      out[label] = new TextDecoder(label).encoding;
    } catch {
      out[label] = null;
    }
  }
  return out;
}

/** Sorted, de-duplicated canonical names of the accepted labels. */
export function acceptedNames(probe: Record<string, string | null>): string[] {
  return [...new Set(Object.values(probe).filter((v): v is string => v !== null))].sort();
}
