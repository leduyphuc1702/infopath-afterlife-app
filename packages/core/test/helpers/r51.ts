// The R5.1 items, found in a render result's `html` and `css` strings (spec 03 R5.1). Used by the
// sanitiser tests and the goldens. Returns one line per item found; [] when clean. The HTML is
// read the way core's serialiser writes it: double-quoted attribute values with `"`, `<` and `>`
// escaped.

const ELEMENTS = new Set([
  ...['script', 'object', 'embed', 'applet', 'iframe', 'frame', 'frameset', 'base', 'form'],
  ...['link', 'meta'],
]);
const URL_ATTRS = new Set([
  'href',
  'src',
  'action',
  'formaction',
  'xlink:href',
  'srcset',
  'poster',
]);
const RASTER = /^data:image\/(?:png|gif|jpeg|bmp);base64,/;

export interface Tag {
  readonly name: string;
  readonly attrs: readonly (readonly [string, string])[];
}

/** Every start tag of serialised HTML, with its attributes decoded. */
export function startTags(html: string): Tag[] {
  const tags: Tag[] = [];
  for (const m of html.matchAll(/<([a-zA-Z][^\s>/]*)((?:\s[^\s="'>/]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    const attrs = [...m[2]!.matchAll(/\s([^\s="'>/]+)(?:="([^"]*)")?/g)].map(
      (a) => [a[1]!, decode(a[2] ?? '')] as const,
    );
    tags.push({ name: m[1]!.toLowerCase(), attrs });
  }
  return tags;
}

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

export function r51Items(html: string, css: string): string[] {
  const found: string[] = [];
  const styles = [css];
  for (const tag of startTags(html)) {
    if (ELEMENTS.has(tag.name)) found.push(`element ${tag.name}`);
    for (const [name, value] of tag.attrs) {
      const n = name.toLowerCase();
      if (n.startsWith('on')) found.push(`attribute ${n}`);
      if (n === 'style') styles.push(value);
      if (URL_ATTRS.has(n)) {
        const v = [...value]
          .filter((ch) => ch > ' ' && ch !== '\x7f')
          .join('')
          .toLowerCase();
        const ok = n === 'href' ? /^(?:https?|mailto):/.test(v) : RASTER.test(v);
        if (!ok) found.push(`url ${n}=${value}`);
      }
    }
  }
  const flat = styles.join('\n').toLowerCase().replace(/\s+/g, '');
  for (const m of flat.matchAll(/url\(([^)]*)\)/g)) {
    if (!RASTER.test(m[1]!.replace(/^["']/, ''))) found.push(`css url(${m[1]})`);
  }
  for (const item of ['expression(', 'behavior:', '-moz-binding', '@import']) {
    if (flat.includes(item)) found.push(`css ${item}`);
  }
  return found;
}
