// The R10.1 normalisation (spec 03 design §10, steps 1–8), applied to both the engine's
// fallback HTML and the `xsltproc` reference. The result is one node per line, indented by
// depth, so a mismatch shows as a readable diff.

import { parse } from 'parse5';

/** Step 7: HTML boolean attributes; their values are emptied. */
const BOOLEAN = new Set([
  ...['checked', 'selected', 'disabled', 'nowrap', 'readonly', 'multiple', 'noshade'],
  ...['compact', 'defer', 'ismap', 'nohref', 'noresize', 'declare'],
]);

interface Node {
  readonly nodeName: string;
  readonly tagName?: string;
  readonly value?: string;
  readonly data?: string;
  readonly attrs?: readonly { readonly name: string; readonly value: string }[];
  readonly childNodes?: readonly Node[];
  readonly content?: Node;
}

/** Step 6: ASCII whitespace runs become one space, then trimmed. */
const ws = (s: string) => s.replace(/[\t\n\f\r ]+/g, ' ').trim();

export function normaliseHtml(html: string): string {
  const doc = parse(html) as unknown as Node; // step 1
  const lines: string[] = [];
  /** Step 8: `generate-id()` values (the `name` of `input` elements), in order of appearance. */
  const ids = new Map<string, string>();
  const walk = (node: Node, depth: number) => {
    for (const child of node.childNodes ?? []) {
      const pad = '  '.repeat(depth);
      if (child.nodeName === '#comment' || child.nodeName === '#documentType') continue; // 2
      if (child.nodeName === '#text') {
        const text = ws(child.value ?? '');
        if (text !== '') lines.push(`${pad}${JSON.stringify(text)}`);
        continue;
      }
      const tag = child.tagName ?? child.nodeName;
      const attrs = (child.attrs ?? [])
        .filter((a) => a.name !== 'xmlns' && !a.name.startsWith('xmlns:')) // 4
        .map((a) => {
          let value = ws(a.value);
          if (BOOLEAN.has(a.name)) value = '';
          if (tag === 'input' && a.name === 'name') {
            if (!ids.has(value)) ids.set(value, `id${ids.size + 1}`);
            value = ids.get(value)!;
          }
          return [a.name, value] as const;
        });
      // Step 3: the Content-Type meta.
      const httpEquiv = attrs.find(([n]) => n === 'http-equiv')?.[1];
      if (tag === 'meta' && httpEquiv?.toLowerCase() === 'content-type') continue;
      attrs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); // 5
      lines.push(`${pad}<${tag}${attrs.map(([n, v]) => ` ${n}=${JSON.stringify(v)}`).join('')}>`);
      walk(child.content ?? child, depth + 1);
    }
  };
  walk(doc, 0);
  return `${lines.join('\n')}\n`;
}
