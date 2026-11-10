import { readdirSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export const OWN = new URL('../../../samples/own/', import.meta.url);
export const xsnPath = (slug: string) => new URL(`xsn/${slug}.xsn`, OWN).pathname;
/** A form's record files, without the `-000-empty.xml` (as the bundled samples). */
export const recordPaths = (slug: string, n = Infinity) =>
  readdirSync(new URL(`records/${slug}/`, OWN))
    .filter((f) => !f.endsWith('-000-empty.xml'))
    .sort()
    .slice(0, n)
    .map((f) => new URL(`records/${slug}/${f}`, OWN).pathname);
export const bytes = (path: string) => readFileSync(path);

type Payload = string | { name: string; mimeType: string; buffer: Buffer };

/** Opens files through the "Open files" picker. */
export async function pick(page: Page, files: Payload[]) {
  const buffers = files.map((f) =>
    typeof f === 'string'
      ? {
          name: f.slice(f.lastIndexOf('/') + 1),
          mimeType: 'application/octet-stream',
          buffer: bytes(f),
        }
      : f,
  );
  await page.locator('[data-afl-picker]').setInputFiles(buffers);
}
