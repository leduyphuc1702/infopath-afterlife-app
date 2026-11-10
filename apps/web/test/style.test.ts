import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// R9.3: page colours come from @atlaskit/tokens. No colour literal in `src/**/*.css` outside
// `paper.css`, whose white page and black text are InfoPath's, in both colour schemes.
const SRC = new URL('../src/', import.meta.url);
const NAMED =
  'white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|navy|maroon|teal|olive|lime|aqua|fuchsia|pink|brown|gold|beige|ivory|tan|crimson|indigo|violet|salmon|coral|khaki|lavender|plum|orchid|tomato|wheat|snow|linen';
const LITERAL = new RegExp(
  `#[0-9a-f]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(|:[^;{}]*\\b(?:${NAMED})\\b`,
  'gi',
);

test('no colour literal in the app CSS outside paper.css', () => {
  const files = readdirSync(SRC, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.css') && !f.endsWith('paper.css'));
  expect(files.length).toBeGreaterThanOrEqual(2);
  const found: string[] = [];
  for (const f of files) {
    const css = readFileSync(new URL(f, SRC), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // Property values only: `white-space: pre-wrap` is not a colour.
    for (const decl of css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
      if (/^(white-space|font|font-family)$/.test(decl[1]!)) continue;
      for (const m of `:${decl[2]}`.matchAll(LITERAL)) found.push(`${f}: ${decl[1]}: ${m[0]}`);
    }
  }
  expect(found).toEqual([]);
});

test('the oracle finds the literals it looks for', () => {
  for (const bad of [
    'color: #fff',
    'background: rgb(0 0 0)',
    'border: 1px solid red',
    'color: oklch(1 0 0)',
  ])
    expect(`:${bad.split(':')[1]}`.match(LITERAL), bad).not.toBeNull();
  expect(':var(--ds-text)'.match(LITERAL)).toBeNull();
});
