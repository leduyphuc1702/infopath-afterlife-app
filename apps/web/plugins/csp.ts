// Spec 09 design §6, D9: one policy for the `<meta>` tag (any static host) and for `_headers`
// (Cloudflare Pages), which can also forbid framing. The meta tag is added at build only, because
// Vite's dev server needs inline scripts.
import type { Plugin } from 'vite';

/** `Changed at review:` `connect-src 'none'` (R8.2): nothing fetches. */
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "worker-src 'self'",
  // The views' `style` attributes and each render's `<style>` (design §6).
  "style-src 'self' 'unsafe-inline'",
  // Package images arrive as data URLs (spec 03 R6.1).
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const HEADERS = [
  '/*',
  `  Content-Security-Policy: ${CSP}; frame-ancestors 'none'`,
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '',
].join('\n');

export function csp(): Plugin {
  return {
    name: 'afterlife:csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
    },
  };
}
