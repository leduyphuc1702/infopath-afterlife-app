// Spec 12 P9: does a FormIR `Located` path select a node in its file? Paths are FormIR's:
// `/xsf:xDocumentClass[1]/xsf:views[1]/@default`, with `{uri}local` steps where the source used a
// namespace URI (views), and `@name` or `@{uri}local` for attributes.
import { DOMParser, type Element, type Node } from '@xmldom/xmldom';

const STEP = /\/(@?(?:\{[^}]*\})?[^/[{]+)(?:\[(\d+)\])?/g;

export function selects(xml: string, path: string): boolean {
  const doc = new DOMParser({ onError: () => undefined }).parseFromString(xml, 'text/xml');
  let node: Node | null = doc;
  for (const m of path.matchAll(STEP)) {
    if (!node) return false;
    const [, step, idx] = m;
    const ns = /^@?\{([^}]*)\}(.*)$/.exec(step!);
    if (step!.startsWith('@')) {
      const el = node as Element;
      const attr = ns ? el.getAttributeNodeNS(ns[1]!, ns[2]!) : el.getAttributeNode(step!.slice(1));
      node = attr;
      continue;
    }
    const n = Number(idx ?? 1);
    let count = 0;
    let next: Node | null = null;
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const e = c as Element;
      const hit = ns ? e.namespaceURI === ns[1] && e.localName === ns[2] : e.nodeName === step;
      if (hit && ++count === n) {
        next = c;
        break;
      }
    }
    node = next;
  }
  return node !== null;
}
