// Host helper, not core API (spec 09 D3; `@afterlife/core/host/vite`). Spec 03 design §5.2:
// `xsltjs`'s Stylesheet.js requires `fs` and `path` at module level. Browser and Worker builds map
// those two requires, from xsltjs only, to core's throwing stubs. Core's tests, the web viewer and
// the Forge Custom UI bundles all use this plugin.

import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const stubs = fileURLToPath(new URL('../src/render/engine/stubs/', import.meta.url));

/** The stub file for `source` when `importer` is inside the xsltjs package, else undefined. */
export function xsltjsStub(source: string, importer: string | undefined): string | undefined {
  if (!importer || !/[\\/]node_modules[\\/]xsltjs[\\/]/.test(importer)) return undefined;
  const bare = source.startsWith('node:') ? source.slice('node:'.length) : source;
  return bare === 'fs' || bare === 'path' ? `${stubs}${bare}.ts` : undefined;
}

export function xsltjsStubs(): Plugin {
  return {
    name: 'afterlife:xsltjs-stubs',
    enforce: 'pre',
    resolveId: (source, importer) => xsltjsStub(source, importer) ?? null,
  };
}
