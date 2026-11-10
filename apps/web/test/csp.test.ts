import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CSP, HEADERS } from '../plugins/csp';

// R8.2: the meta tag and `_headers` carry the same policy; `_headers` adds `frame-ancestors`.
// The `dist` checks run when a build exists (the e2e command builds first).
const dist = new URL('../dist/', import.meta.url);

test('the policy is the one design §6 names', () => {
  expect(CSP.split('; ')).toEqual([
    "default-src 'none'",
    "script-src 'self'",
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ]);
  expect(HEADERS).toContain(`Content-Security-Policy: ${CSP}; frame-ancestors 'none'\n`);
});

describe.runIf(existsSync(new URL('index.html', dist)))('dist', () => {
  test('index.html carries the policy first in head; _headers adds frame-ancestors', () => {
    const html = readFileSync(new URL('index.html', dist), 'utf8');
    const meta = /<head>\s*<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html);
    expect(meta?.[1]?.replaceAll('&#39;', "'").replaceAll('&apos;', "'")).toBe(CSP);
    expect(readFileSync(new URL('_headers', dist), 'utf8')).toBe(HEADERS);
  });
});
