// The InfoPath file attachment header (spec 03 R6.7, design §9.3). A FileAttachment control's node
// holds base64 of: the file metadata of [MS-IPFFX] §2.1.3.1, then the file bytes. Only the
// metadata is decoded here: 24 fixed bytes, then the UTF-16LE name. The file bytes are never
// decoded (spec 11); their length is read from the base64 length, to check the declared size.
//
//   offset  0  signature         C7 49 46 41
//           4  header size       20 (uint32 LE)
//           8  version           1
//          12  reserved          0
//          16  file size         bytes of the file part
//          20  file name length  UTF-16 code units, with one terminating zero; > 1
//          24  file name         file name length × 2 bytes

export type AttachmentProblem =
  'base64' | 'truncated' | 'signature' | 'header' | 'nameLength' | 'name' | 'size';

export type Attachment =
  { readonly name: string; readonly size: number } | { readonly problem: AttachmentProblem };

/** File name length cap, in UTF-16 code units with the terminating zero. MS-IPFFX sets none. */
export const MAX_NAME_UNITS = 1024;

const FIXED = 24;
const SIGNATURE = [0xc7, 0x49, 0x46, 0x41];
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function attachmentHeader(text: string): Attachment {
  const b64 = text.replace(/[\t\n\r ]+/g, '');
  if (b64.length % 4 !== 0 || !BASE64.test(b64)) return { problem: 'base64' };
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const total = (b64.length / 4) * 3 - pad;
  if (total < FIXED) return { problem: 'truncated' };

  const fixed = decodePrefix(b64, FIXED);
  if (!SIGNATURE.every((b, i) => fixed[i] === b)) return { problem: 'signature' };
  const u32 = (o: number) =>
    (fixed[o]! | (fixed[o + 1]! << 8) | (fixed[o + 2]! << 16) | (fixed[o + 3]! << 24)) >>> 0;
  if (u32(4) !== 20 || u32(8) !== 1 || u32(12) !== 0) return { problem: 'header' };
  const size = u32(16);
  const units = u32(20);
  if (units < 2 || units > MAX_NAME_UNITS) return { problem: 'nameLength' };
  const end = FIXED + units * 2;
  if (end > total) return { problem: 'truncated' };

  const head = decodePrefix(b64, end);
  let name = '';
  for (let i = 0; i < units; i++) {
    const unit = head[FIXED + 2 * i]! | (head[FIXED + 2 * i + 1]! << 8);
    const last = i === units - 1;
    if ((unit === 0) !== last) return { problem: 'name' };
    if (!last) name += String.fromCharCode(unit);
  }
  if (total - end !== size) return { problem: 'size' };
  // A lone surrogate becomes U+FFFD, as String#toWellFormed would.
  return {
    name: name.replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      '\uFFFD',
    ),
    size,
  };
}

/** The first `bytes` bytes of the base64 text, decoding only the characters that hold them. */
function decodePrefix(b64: string, bytes: number): Uint8Array {
  const binary = atob(b64.slice(0, Math.ceil(bytes / 3) * 4));
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** `109 bytes`, as InfoPath shows it (`02-expense-report-Claim-filled.png`). */
export function sizeText(size: number): string {
  return `${size} ${size === 1 ? 'byte' : 'bytes'}`;
}
