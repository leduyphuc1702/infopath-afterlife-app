// Spec 09 R12.6: what a base64 field holds. A file attachment carries InfoPath's header, which
// spec 03's `attachmentHeader` checks ([MS-IPFFX] §2.1.3.1, the layout in `render/attachment.ts`,
// matching the `my:receipt` fields of 29 of our form 02 records). Without the signature it is a
// picture (an inline image, form 06's `my:scenePhoto`), named by its magic number; a header that
// fails its checks, or bytes with no known magic, are kept as data.
import { attachmentHeader } from '../render/attachment';

export type Embedded =
  | { readonly kind: 'attachment'; readonly fileName: string; readonly bytes: Uint8Array }
  | { readonly kind: 'picture'; readonly ext: string; readonly bytes: Uint8Array }
  | { readonly kind: 'data'; readonly bytes: Uint8Array };

const MAGIC: readonly (readonly [string, readonly number[]])[] = [
  ['png', [0x89, 0x50, 0x4e, 0x47]],
  ['jpg', [0xff, 0xd8, 0xff]],
  ['gif', [0x47, 0x49, 0x46, 0x38]],
  ['bmp', [0x42, 0x4d]],
  ['tif', [0x49, 0x49, 0x2a, 0x00]],
  ['tif', [0x4d, 0x4d, 0x00, 0x2a]],
];

function fromBase64(text: string): Uint8Array | undefined {
  const s = text.replace(/[\t\n\r ]+/g, '');
  if (s === '' || s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return undefined;
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
}

/** The file or picture a base64 field holds; undefined for empty or non-base64 text. */
export function embedded(text: string): Embedded | undefined {
  const b = fromBase64(text);
  if (!b) return undefined;
  const h = attachmentHeader(text);
  if ('name' in h)
    return { kind: 'attachment', fileName: h.name, bytes: b.subarray(b.length - h.size) };
  if (h.problem !== 'signature' && h.problem !== 'truncated') return { kind: 'data', bytes: b };
  const hit = MAGIC.find(([, m]) => m.every((x, i) => b[i] === x));
  return hit ? { kind: 'picture', ext: hit[0], bytes: b } : { kind: 'data', bytes: b };
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

/** One path segment that is safe on every system: no separators, no `..`, no control characters. */
export function safeSegment(name: string, max = 100): string {
  // eslint-disable-next-line no-control-regex
  let s = name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_').replace(/^[\s.]+|[\s.]+$/g, '');
  if (s === '') s = 'file';
  if (RESERVED.test(s)) s = `_${s}`;
  if (s.length > max) {
    const dot = s.lastIndexOf('.');
    const ext = dot > 0 && s.length - dot <= 10 ? s.slice(dot) : '';
    s = s.slice(0, max - ext.length) + ext;
  }
  return s;
}
