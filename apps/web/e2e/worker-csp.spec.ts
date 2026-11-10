import { test as base, expect, type Page, type Worker } from '@playwright/test';
import { CSP } from '../plugins/csp';

// Spec 09 design §6, task 8: does the module Worker get the page's `<meta>` policy? The probe is
// a same-origin `fetch`, which `connect-src 'none'` forbids, run in the page and inside the real
// app Worker. This spec uses Playwright's plain `test`, not the guarded fixture, because the
// probe raises violations on purpose.
//
// 1. As built and served by `vite preview` (headers like GitHub Pages: none), the policy comes
//    from the `<meta>` tag alone.
// 2. With `dist/_headers`' policy sent on the Worker script's response, as Cloudflare Pages does
//    for `/*`, the Worker gets that policy, and the app still works under it.

const test = base;

const sameOriginFetch = () =>
  fetch(location.href).then(
    (r) => `allowed ${r.status}`,
    (e: unknown) => `blocked ${String(e)}`,
  );
const probe = (where: Page | Worker): Promise<string> =>
  'mainFrame' in where ? where.evaluate(sameOriginFetch) : where.evaluate(sameOriginFetch);

async function appWorker(page: Page): Promise<Worker> {
  await page.goto('./');
  await expect(page.locator('html[data-ready]')).toHaveCount(1);
  const w = page.workers().find((x) => /\/assets\/worker-[\w-]+\.js$/.test(x.url()));
  expect(
    w,
    page
      .workers()
      .map((x) => x.url())
      .join(', '),
  ).toBeDefined();
  return w!;
}

test('meta only (GitHub Pages): the page is bound by the policy, the Worker is not', async ({
  page,
}) => {
  const worker = await appWorker(page);
  expect(await probe(page)).toMatch(/^blocked /);
  expect(await probe(worker)).toBe('allowed 200');
});

test("_headers' policy on the Worker's response (Cloudflare Pages): the Worker is bound, and still works", async ({
  page,
  context,
}) => {
  const sent: string[] = [];
  await context.route(/\/assets\/worker-[\w-]+\.js$/, async (route) => {
    const response = await route.fetch();
    sent.push(route.request().url());
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': `${CSP}; frame-ancestors 'none'`,
      },
    });
  });
  const worker = await appWorker(page);
  expect(sent).toHaveLength(1);
  expect(await probe(worker)).toMatch(/^blocked /);
  // The Worker's own work (the samples chunk, parsing, rendering) needs nothing the policy forbids.
  await page.getByRole('button', { name: /^Expense report/ }).click();
  await expect(
    page.getByRole('region', { name: /Claim view, empty form$/ }).locator('.afl-root'),
  ).toBeVisible();
});
