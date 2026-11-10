// The fixed render input of the spec 03 goldens (design §10). No Node imports: the Worker
// parity tests use it too.

export const GOLDEN_INPUT = {
  now: '2026-11-03T09:00:00-08:00',
  locale: 'en-US',
  userName: 'Test User',
} as const;

/** `test/golden/render/<slug>/<view stem>.<record>.json`, relative to `test/`. */
export const renderGoldenPath = (slug: string, xslFile: string, record: 'empty' | 'first') =>
  `golden/render/${slug}/${xslFile.replace(/\.xsl$/i, '')}.${record}.json`;
