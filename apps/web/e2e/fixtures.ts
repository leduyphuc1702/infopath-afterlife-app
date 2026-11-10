// Spec 09 design §9: three guards on every e2e test. A request to another origin (page or
// Worker), a `securitypolicyviolation` event, or an uncaught page error fails the test (R8.1, R8.2).
import { test as base, expect } from '@playwright/test';

declare global {
  interface Window {
    __aflViolations: string[];
  }
}

export const test = base.extend<{ guards: void }>({
  guards: [
    async ({ page, context, baseURL }, use) => {
      const origin = new URL(baseURL!).origin;
      const foreign: string[] = [];
      const errors: string[] = [];
      context.on('request', (r) => {
        const url = new URL(r.url());
        if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== origin)
          foreign.push(r.url());
      });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(() => {
        window.__aflViolations = [];
        document.addEventListener('securitypolicyviolation', (e) =>
          window.__aflViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await use();
      const violations = page.isClosed() ? [] : await page.evaluate(() => window.__aflViolations);
      expect({ foreign, violations, errors }).toEqual({ foreign: [], violations: [], errors: [] });
    },
    { auto: true },
  ],
});

export { expect };
