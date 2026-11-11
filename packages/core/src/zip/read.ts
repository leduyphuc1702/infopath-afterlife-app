// Spec 09 R12.6, design §12: a zip reader for hostile input, in the cabinet reader's stance.
// The central directory is read and checked whole before a byte is inflated: entry count, the
// declared total and each large entry's ratio against `Limits`; every offset in bounds. ZIP64,
// encryption, multi-disk sets and methods other than stored (0) and deflate (8) are refused with
// UNSUPPORTED_ZIP. A name that could leave its folder (`..`, absolute, a drive, control
// characters) makes the archive CORRUPT_ZIP. Deflate goes through the cabinet's `inflateBlock`,
// which stops at the declared size, so a lying entry cannot grow past it; then the CRC is checked.
import { inflateBlock } from '../cab/inflate';
import { AfterlifeError } from '../errors';
import { resolveLimits, type Limits } from '../limits';
import { crc32 } from './crc32';

export interface ZipEntry {
  /** `/`-separated, `.` and empty segments removed; never absolute, never with `..`. */
  readonly name: string;
  readonly directory: boolean;
  /** Declared uncompressed size. */
  readonly size: number;
  readonly compressedSize: number;
  /** The entry's bytes, checked against its size and CRC-32. */
  read(): Promise<Uint8Array<ArrayBuffer>>;
}

export interface ReadZipOptions {
  readonly limits?: Partial<Limits>;
}

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;
const ZIP64_LOCATOR = 0x07064b50;
const MiB = 1024 * 1024;

const corrupt = (offset: number, reason: string) =>
  new AfterlifeError('CORRUPT_ZIP', { offset, reason });

// CP437, bytes 0x80–0xFF: the names of zips written without the UTF-8 flag (Windows Explorer).
const CP437 =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';

function decodeName(raw: Uint8Array, utf8Flag: boolean, at: number): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    if (utf8Flag) throw corrupt(at, 'entry name is not UTF-8');
    return Array.from(raw, (b) => (b < 0x80 ? String.fromCharCode(b) : CP437[b - 0x80]!)).join('');
  }
}

/** The safe form of an entry name, or undefined when it could reach outside its folder. */
export function safeName(name: string): string | undefined {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) return undefined;
  const slashed = name.replaceAll('\\', '/');
  if (slashed.startsWith('/') || /^[a-zA-Z]:/.test(slashed)) return undefined;
  const parts = slashed.split('/').filter((p) => p !== '' && p !== '.');
  if (parts.some((p) => p === '..')) return undefined;
  return parts.join('/');
}

export function readZip(bytes: Uint8Array, options: ReadZipOptions = {}): ZipEntry[] {
  const limits = resolveLimits(options.limits);
  if (bytes.length > limits.inputBytes)
    throw new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'inputBytes',
      max: limits.inputBytes,
      observed: bytes.length,
    });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => {
    if (at < 0 || at + 2 > bytes.length) throw corrupt(at, 'u16 outside the input');
    return view.getUint16(at, true);
  };
  const u32 = (at: number) => {
    if (at < 0 || at + 4 > bytes.length) throw corrupt(at, 'u32 outside the input');
    return view.getUint32(at, true);
  };

  // The end record: the last signature whose comment ends at or before the end of the input.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (
      view.getUint32(at, true) === EOCD &&
      at + 22 + view.getUint16(at + 20, true) <= bytes.length
    ) {
      end = at;
      break;
    }
  }
  if (end < 0) throw corrupt(0, 'no end of central directory record');
  if (end >= 20 && view.getUint32(end - 20, true) === ZIP64_LOCATOR)
    throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'zip64' });
  if (u16(end + 4) !== 0 || u16(end + 6) !== 0 || u16(end + 8) !== u16(end + 10))
    throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'multiDisk' });
  const count = u16(end + 10);
  const dirSize = u32(end + 12);
  const dirOffset = u32(end + 16);
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff)
    throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'zip64' });
  if (count > limits.entries)
    throw new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'entries',
      max: limits.entries,
      observed: count,
    });
  if (dirOffset + dirSize > end) throw corrupt(dirOffset, 'central directory runs past its end');

  const entries: ZipEntry[] = [];
  let total = 0;
  let at = dirOffset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > dirOffset + dirSize) throw corrupt(at, 'central directory is too short');
    if (u32(at) !== CEN) throw corrupt(at, 'bad central directory signature');
    const flags = u16(at + 8);
    const method = u16(at + 10);
    const crc = u32(at + 16);
    const compressedSize = u32(at + 20);
    const size = u32(at + 24);
    const nameLength = u16(at + 28);
    const next = at + 46 + nameLength + u16(at + 30) + u16(at + 32);
    const local = u32(at + 42);
    if (next > dirOffset + dirSize) throw corrupt(at, 'central directory entry runs past its end');
    if (flags & 0x41) throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'encryption' });
    if (size === 0xffffffff || compressedSize === 0xffffffff || local === 0xffffffff)
      throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'zip64' });
    if (method !== 0 && method !== 8)
      throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'method', method });
    const raw = decodeName(
      bytes.subarray(at + 46, at + 46 + nameLength),
      (flags & 0x800) !== 0,
      at,
    );
    const name = safeName(raw);
    if (name === undefined) throw corrupt(at, 'unsafe entry name');
    if (method === 0 && size !== compressedSize) throw corrupt(at, 'stored entry sizes differ');
    if (size >= MiB && size / Math.max(1, compressedSize) > limits.zipRatio)
      throw new AfterlifeError('LIMIT_EXCEEDED', {
        limit: 'zipRatio',
        max: limits.zipRatio,
        observed: Math.round(size / Math.max(1, compressedSize)),
        file: name,
      });
    total += size;
    if (total > limits.uncompressedBytes)
      throw new AfterlifeError('LIMIT_EXCEEDED', {
        limit: 'uncompressedBytes',
        max: limits.uncompressedBytes,
        observed: total,
      });

    const directory = raw.endsWith('/') || raw.endsWith('\\');
    entries.push({
      name,
      directory,
      size,
      compressedSize,
      read: async () => {
        if (u32(local) !== LOC) throw corrupt(local, 'bad local header signature');
        const start = local + 30 + u16(local + 26) + u16(local + 28);
        if (start + compressedSize > bytes.length)
          throw corrupt(local, 'entry data runs past the end');
        const data = bytes.subarray(start, start + compressedSize);
        let out: Uint8Array<ArrayBuffer>;
        if (method === 0) out = data.slice();
        else
          try {
            out = await inflateBlock(data, new Uint8Array(0), size, start);
          } catch (e) {
            const reason = e instanceof AfterlifeError ? String(e.details.reason) : String(e);
            throw corrupt(start, reason);
          }
        if (crc32(out) !== crc) throw corrupt(start, 'CRC-32 does not match');
        return out;
      },
    });
    at = next;
  }
  return entries;
}
