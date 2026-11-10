// The HTML tree post-processing builds and the serialiser that writes it (spec 03 design §8.3).
// No HTML string is ever re-parsed (D4): text and attribute values are escaped here, once.

export interface HElement {
  readonly kind: 'element';
  /** Lowercase HTML name. */
  readonly name: string;
  /** Lowercase names, in output order, each once. */
  attrs: [string, string][];
  children: HNode[];
  /** The result-tree element this one came from, for control marks (§9). */
  readonly origin?: object;
}

export interface HText {
  readonly kind: 'text';
  readonly text: string;
}

export type HNode = HElement | HText;

const VOID = new Set(['br', 'col', 'hr', 'img', 'input', 'wbr']);

export function serialiseHtml(node: HNode): string {
  const out: string[] = [];
  write(node, out);
  return out.join('');
}

function write(node: HNode, out: string[]): void {
  if (node.kind === 'text') {
    out.push(escapeText(node.text));
    return;
  }
  out.push('<', node.name);
  for (const [name, value] of node.attrs) {
    out.push(' ', name);
    if (value !== '') out.push('="', escapeAttr(value), '"');
  }
  out.push('>');
  if (VOID.has(node.name)) return;
  if (node.name === 'textarea' || node.name === 'pre') {
    // textarea holds text only. The parser drops one LF right after the start tag (WHATWG).
    const text = node.name === 'textarea' ? textOf(node) : undefined;
    const first = text ?? (node.children[0]?.kind === 'text' ? node.children[0].text : '');
    if (first.startsWith('\n')) out.push('\n');
    if (text !== undefined) out.push(escapeText(text));
    else for (const child of node.children) write(child, out);
  } else {
    for (const child of node.children) write(child, out);
  }
  out.push('</', node.name, '>');
}

export function textOf(node: HNode): string {
  return node.kind === 'text' ? node.text : node.children.map(textOf).join('');
}

const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\0/g, '\uFFFD');

const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;');
