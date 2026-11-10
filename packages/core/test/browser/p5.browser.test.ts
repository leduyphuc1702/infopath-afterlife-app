import fc from 'fast-check';
import { expect, test } from 'vitest';
import {
  AfterlifeError,
  buildFormIR,
  parsePackage,
  prepareView,
  renderView,
} from '../../src/index';
import type { PackageFile } from '../../src/cab/reader';
import { r51Items } from '../helpers/r51';
import { manifestBytes } from '../helpers/synthetic-manifest';
import { P5_REGRESSIONS } from '../property/regressions';
import { p5Input, recordXml, viewXsl, type ItemKind, type P5Input } from './p5-inputs';

// Property P5 (spec 03 R8.1, design §11): for hostile view XSL and records (p5-inputs.ts), the
// render result holds none of the R5.1 items. The oracle is Chromium's own parsers:
// `template.innerHTML` for the HTML and `CSSStyleSheet.replaceSync` for the CSS, then a walk of
// the parsed trees. Markup that changes meaning when parsed (mXSS) is judged as the browser
// reads it. A render that throws returns no HTML (R1.3), which is safe; it is counted.

const RUNS = Number(import.meta.env.VITE_P5_RUNS ?? 500);
/** A seed to replay locally (`VITE_P5_SEED`); CI runs use a fresh one. */
const SEED =
  import.meta.env.VITE_P5_SEED === undefined ? undefined : Number(import.meta.env.VITE_P5_SEED);
const NOW = '2026-11-03T09:00:00-08:00';
const XHTML = 'http://www.w3.org/1999/xhtml';
const enc = new TextEncoder();
const BASE = 'https://base.invalid/';

/** Elements that must not exist after parsing: R5.1, and what the allowlist refuses (D5). */
const FORBIDDEN = new Set([
  ...['script', 'object', 'embed', 'applet', 'iframe', 'frame', 'frameset', 'base', 'form'],
  ...['link', 'meta', 'style', 'title', 'noscript', 'template', 'noembed', 'noframes', 'xmp'],
  ...['plaintext', 'audio', 'video', 'source', 'track', 'param', 'canvas', 'svg', 'math'],
  ...['portal', 'image', 'isindex', 'keygen', 'listing', 'marquee', 'dialog', 'details'],
]);
/**
 * Attributes that must not exist: URL carriers the design drops (§8.2), and focus or editing
 * (R5.4). `xml:base` is not here: HTML documents ignore it, and SVG and MathML never survive.
 */
const DENIED = new Set([
  ...['srcdoc', 'action', 'formaction', 'ping', 'xlink:href', 'contenteditable', 'tabindex'],
  ...['accesskey', 'autofocus'],
]);
const LOADING = new Set(['src', 'srcset', 'poster', 'background', 'lowsrc', 'dynsrc', 'data']);
const RASTER = /^data:image\/(?:png|gif|jpeg|bmp);base64,[a-z0-9+/=]*$/i;

const rasterUrl = (value: string) => {
  try {
    return RASTER.test(new URL(value, BASE).href);
  } catch {
    return false;
  }
};

/** CSS text as a legacy engine might read it: comments out, escapes decoded, no whitespace. */
function cssFlat(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '')
    .replace(
      /\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([^\n\r\f0-9a-fA-F])/g,
      (_m, hex?: string, ch?: string) => {
        if (hex === undefined) return ch!;
        const c = parseInt(hex, 16);
        return c === 0 || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)
          ? '\uFFFD'
          : String.fromCodePoint(c);
      },
    )
    .toLowerCase()
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 0x20 && ch !== '\u00a0')
    .join('');
}

function cssTextItems(css: string, where: string, out: string[]): void {
  const flat = cssFlat(css);
  for (const item of [
    'expression(',
    'behavior:',
    '-moz-binding',
    '@import',
    'image-set(',
    'image(',
    'element(',
    'src(',
  ]) {
    if (flat.includes(item)) out.push(`${where}: css text ${item}`);
  }
  for (const m of flat.matchAll(/url\(([^)]*)\)?/g)) {
    const arg = m[1]!.replace(/^["']|["']$/g, '');
    if (!RASTER.test(arg)) out.push(`${where}: css text url(${m[1]})`);
  }
}

/** A parsed declaration block: every value Chromium kept, custom properties included. */
function declarationItems(style: CSSStyleDeclaration, where: string, out: string[]): void {
  for (let i = 0; i < style.length; i++) {
    const prop = style.item(i);
    const value = style.getPropertyValue(prop);
    for (const m of value.matchAll(
      /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)]*))\s*\)/gi,
    )) {
      const arg = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1');
      if (!RASTER.test(arg)) out.push(`${where}: ${prop} url(${arg})`);
    }
    if (/expression\(|image-set\(|(?:^|[^-\w])image\(|element\(/i.test(value))
      out.push(`${where}: ${prop}: ${value}`);
  }
}

/** Top-level commas of a selector list, ignoring those in brackets, parentheses and strings. */
function selectors(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim());
}

function sheetItems(rules: CSSRuleList, out: string[], nested: boolean): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      if (!nested) {
        for (const sel of selectors(rule.selectorText)) {
          if (!sel.includes('.afl-root')) out.push(`css: unscoped selector ${sel}`);
        }
      }
      declarationItems(rule.style, `css ${rule.selectorText}`, out);
      sheetItems(rule.cssRules, out, true);
    } else if (rule instanceof CSSMediaRule) {
      sheetItems(rule.cssRules, out, nested);
    } else {
      out.push(`css: ${rule.constructor.name} ${rule.cssText.slice(0, 60)}`);
    }
  }
}

/** Everything the render result holds that R5.1 (and D5, R5.4) forbids, as Chromium reads it. */
export function violations(html: string, css: string): string[] {
  const out: string[] = [];
  const t = document.createElement('template');
  t.innerHTML = html;
  const top = [...t.content.childNodes];
  const root = top[0];
  if (
    top.length !== 1 ||
    !(root instanceof HTMLDivElement) ||
    !root.classList.contains('afl-root') ||
    !root.hasAttribute('inert')
  ) {
    out.push(`root: ${top.length} top-level nodes, first ${top[0]?.nodeName}`);
  }
  // mXSS: the tree Chromium serialises from the parsed tree is parsed again and checked too.
  const again = document.createElement('template');
  again.innerHTML = t.innerHTML;

  const walk = (parent: ParentNode) => {
    for (const el of parent.querySelectorAll('*')) {
      const name = el.localName;
      if (el.namespaceURI !== XHTML) out.push(`element ${el.namespaceURI} ${name}`);
      if (FORBIDDEN.has(name)) out.push(`element ${name}`);
      if (el instanceof HTMLTemplateElement) walk(el.content);
      for (const a of el.attributes) {
        const n = a.name.toLowerCase();
        if (a.namespaceURI !== null) out.push(`attribute ${a.namespaceURI} ${n} on ${name}`);
        if (n.startsWith('on')) out.push(`attribute ${n} on ${name}`);
        if (DENIED.has(n)) out.push(`attribute ${n} on ${name}`);
        if ((n === 'id' || n === 'name' || n === 'for') && !a.value.startsWith('afl-'))
          out.push(`attribute ${n}="${a.value}" on ${name}`);
        if (
          n.startsWith('data-afl-') &&
          n !== 'data-afl-ctrl' &&
          n !== 'data-afl-path' &&
          n !== 'data-afl-scope'
        )
          out.push(`attribute ${n} on ${name}`);
        if (n === 'href') {
          let protocol: string;
          try {
            protocol = new URL(a.value, BASE).protocol;
          } catch {
            protocol = 'invalid';
          }
          if (!['http:', 'https:', 'mailto:'].includes(protocol))
            out.push(`url href=${a.value} on ${name}`);
          if (name !== 'a') out.push(`href on ${name}`);
        }
        if (LOADING.has(n) && !rasterUrl(a.value)) out.push(`url ${n}=${a.value} on ${name}`);
        if (n === 'style') {
          cssTextItems(a.value, `style on ${name}`, out);
          if (el instanceof HTMLElement) declarationItems(el.style, `style on ${name}`, out);
        }
      }
    }
  };
  walk(t.content);
  walk(again.content);

  cssTextItems(css, 'css', out);
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  sheetItems(sheet.cssRules, out, false);
  for (const item of r51Items(html, css)) out.push(`r51: ${item}`);
  return out;
}

const file = (name: string, text: string | Uint8Array): PackageFile => {
  const bytes = typeof text === 'string' ? enc.encode(text) : text;
  return { name, size: bytes.length, date: 0, time: 0, attributes: 0x20, folder: 0, bytes };
};
const MANIFEST = manifestBytes(
  '<xsf:package><xsf:files><xsf:file name="schema.xsd"/><xsf:file name="view1.xsl"/></xsf:files></xsf:package>' +
    '<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:my schema.xsd"/></xsf:documentSchemas>' +
    '<xsf:views default="V"><xsf:view name="V"><xsf:mainpane transform="view1.xsl"/></xsf:view></xsf:views>',
);
const SCHEMA =
  '<xsd:schema targetNamespace="urn:my" xmlns:xsd="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">' +
  '<xsd:element name="r"/></xsd:schema>';

const seen = {
  renders: 0,
  threw: 0,
  kinds: new Map<ItemKind, number>(),
  codes: new Map<string, number>(),
};

/** Renders `input` and returns its violations; [] when it threw (no HTML is returned). */
async function check(input: P5Input): Promise<string[]> {
  for (const it of input.items) seen.kinds.set(it.kind, (seen.kinds.get(it.kind) ?? 0) + 1);
  let result;
  try {
    const t = parsePackage([
      file('manifest.xsf', MANIFEST),
      file('schema.xsd', SCHEMA),
      file('view1.xsl', viewXsl(input)),
    ]);
    const prepared = await prepareView(t, buildFormIR(t));
    result = renderView(prepared, { now: NOW, record: enc.encode(recordXml(input)) });
  } catch (e) {
    if (!(e instanceof AfterlifeError)) throw e;
    seen.threw++;
    const { code } = e as { code: string };
    seen.codes.set(code, (seen.codes.get(code) ?? 0) + 1);
    return [];
  }
  seen.renders++;
  const found = violations(result.html, result.css);
  if (found.length)
    found.push(`--- html\n${result.html}\n--- css\n${result.css.split('\n.afl-root{contain')[0]}`);
  return found;
}

test('the oracle finds each kind of item it looks for', () => {
  const root = (inner: string) => `<div class="afl-root" data-afl-scope="s1" inert>${inner}</div>`;
  const cases: [string, string, string][] = [
    [root('<script>x</script>'), '', 'element script'],
    [root('<svg><a></a></svg>'), '', 'element svg'],
    [root('<math><mi>x</mi></math>'), '', 'element math'],
    [root('<noscript><p>x</p></noscript>'), '', 'element noscript'],
    [root('<p onclick="x">x</p>'), '', 'attribute onclick'],
    [root('<a href="jav&#x09;ascript:x">x</a>'), '', 'url href'],
    [root('<img src="http://e/x.png">'), '', 'url src'],
    [root('<p style="width:e\\78pression(1)">x</p>'), '', 'expression('],
    [root('<p style="background:url(http://e/x)">x</p>'), '', 'url(http://e/x)'],
    [root(''), '.afl-root a{background:url(x)}', 'url(x)'],
    [root(''), 'a{color:red}', 'unscoped selector a'],
    [root(''), '@font-face{font-family:x}', 'CSSFontFaceRule'],
    [root(''), '.afl-root a{b\\65havior:url(x)}', 'behavior:'],
    [root(''), '@import url(x);', '@import'],
    ['<p>x</p>', '', 'root:'],
    [root('</div><p>x</p>'), '', 'root:'],
    [root('<p id="x">x</p>'), '', 'attribute id'],
    [root('<a href="https://ok/" ping="x">x</a>'), '', 'attribute ping'],
  ];
  for (const [html, css, found] of cases) {
    expect(violations(html, css).join('\n'), `${html} ${css}`).toContain(found);
  }
  expect(
    violations(
      root('<a href="https://ok.example/">x</a><img src="data:image/png;base64,AA==">'),
      '.afl-root p{color:red}',
    ),
  ).toEqual([]);
});

test(`${RUNS} runs: no render result holds an R5.1 item, as Chromium parses it`, async () => {
  await fc.assert(
    fc.asyncProperty(p5Input, async (input) => {
      const found = await check(input);
      if (found.length)
        throw new Error(
          `${found.join('\n')}\n--- view\n${viewXsl(input)}\n--- record\n${recordXml(input)}`,
        );
    }),
    { numRuns: RUNS, ...(SEED === undefined ? {} : { seed: SEED }) },
  );
  console.log(
    `P5: ${RUNS} runs, ${seen.renders} rendered, ${seen.threw} threw ${JSON.stringify(Object.fromEntries(seen.codes))}; ` +
      `items ${JSON.stringify(Object.fromEntries(seen.kinds))}`,
  );
  expect(seen.renders).toBeGreaterThan(RUNS * 0.6);
  for (const n of seen.kinds.values()) expect(n).toBeGreaterThan(RUNS / 20);
}, 600_000);

test.each(P5_REGRESSIONS.map((r) => [r.note, r.case] as const))('regression: %s', async (_n, p) => {
  expect(await check(p)).toEqual([]);
});

// Task 12: each way the parser can close an open element implicitly, and so let an orphaned end
// tag close the render root, rendered through copy-of. Each must stay inside the root.
test.each([
  '<select><div><select></select></div></select><p style="position:fixed">out</p>',
  '<select><div><input/></div></select><p>out</p>',
  '<select><div><textarea>t</textarea></div></select><p>out</p>',
  '<button><div><button>x</button></div></button><p>out</p>',
  '<li><div><li>x</li></div></li><p>out</p>',
  '<dd><div><dt>x</dt></div></dd><p>out</p>',
  '<table><tr><td><div><table><table></table></table></div></td></tr></table><p>out</p>',
  '<table><div><table></table></div></table><p>out</p>',
  '<table><span>x<table></table></span></table><p>out</p>',
  '<table><tr><td><div><td>x</td></div></td></tr></table><p>out</p>',
  '<table><caption><div><tr>x</tr></div></caption></table><p>out</p>',
  '<nobr><div><nobr>x</nobr></div></nobr><p>out</p>',
  '<a href="https://ok.example/"><div><a href="https://ok.example/">x</a></div></a><p>out</p>',
])('parser escape stays inside the root: %s', async (rich) => {
  const input: P5Input = {
    items: [{ kind: 'copyOf', xsl: '<xsl:copy-of select="/my:r/my:rich/node()"/>' }],
    wrappers: [0],
    page: false,
    head: [],
    bodyAttrs: [],
    record: { plain: '', url: '', name: 'p', attr: 'title', rich: [rich] },
  };
  const rendered = seen.renders;
  expect(await check(input)).toEqual([]);
  expect(seen.renders).toBe(rendered + 1);
});
