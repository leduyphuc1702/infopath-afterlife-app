import { expect, test } from 'vitest';
import { distFile, readDist } from './dist';
import { existsSync } from 'node:fs';

// What a shared link shows: a title, a sentence and a picture that is in `dist`.
// Not written by Kiro (README, "What Kiro did not write").
const index = readDist('index.html').toString('utf8');
const meta = (key: string) =>
  new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`).exec(index)?.[1];

test('a shared link has a title, a sentence and a picture of the right size', () => {
  expect(meta('og:title')).toBe('InfoPath has retired. Your forms haven’t.');
  expect(meta('og:description')).toMatch(/Nothing is uploaded/);
  expect(meta('twitter:card')).toBe('summary_large_image');
  expect([meta('og:image:width'), meta('og:image:height')]).toEqual(['1200', '630']);
  expect(meta('og:image:alt')).not.toBe('');
});

test('the picture a preview names is published beside the page', () => {
  const page = meta('og:url')!;
  const picture = meta('og:image')!;
  expect(page).toMatch(/^https:\/\/.+\/$/);
  expect(picture.startsWith(page)).toBe(true);
  const file = distFile(picture.slice(page.length));
  expect(existsSync(file)).toBe(true);
  // JPEG: FF D8 at the start, and the size its tags give in a start-of-frame marker.
  const bytes = readDist(picture.slice(page.length));
  expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
  let at = 2;
  let size: number[] = [];
  while (at < bytes.length) {
    const marker = bytes[at + 1]!;
    const length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xc2) {
      size = [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
      break;
    }
    at += 2 + length;
  }
  expect(size).toEqual([1200, 630]);
});
