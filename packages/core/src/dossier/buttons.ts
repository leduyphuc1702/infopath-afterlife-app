// Spec 16 K2: the caption each view shows on its buttons, by `xd:CtrlId`. FormIR records bound
// controls only; buttons are unbound, so their `value` is read from the view XSL here.
import type { ParsedTemplate } from '../xsn/parse';

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};
export const buttonDecode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(
          e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)),
        )
      : (ENTITIES[e] ?? m),
  );
export const xslAttr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')
    .exec(tag)
    ?.slice(2)
    .find((x) => x !== undefined);

export function buttonCaptions(t: ParsedTemplate): Map<string, string> {
  const out = new Map<string, string>();
  // Every `.xsl` in the package: views, and print views, which may carry the same buttons.
  for (const f of t.files) {
    if (!f.name.toLowerCase().endsWith('.xsl')) continue;
    const text = new TextDecoder().decode(f.bytes);
    for (const m of text.matchAll(/<input\b[^>]*>/gi)) {
      const tag = m[0];
      if (xslAttr(tag, 'xd:xctname')?.toLowerCase() !== 'button') continue;
      const id = xslAttr(tag, 'xd:CtrlId');
      const value = xslAttr(tag, 'value');
      if (id !== undefined && value !== undefined && value.trim() !== '' && !out.has(id))
        out.set(id, buttonDecode(value).trim());
    }
  }
  return out;
}
