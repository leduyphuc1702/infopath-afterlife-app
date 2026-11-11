// Spec 09 R12.5, design §12: a zip writer, enough for an `.xlsx` and a `.zip` of CSVs. Local
// headers with the sizes in them (no data descriptors), UTF-8 names (flag bit 11), a central
// directory and its end record. Each entry is deflated through CompressionStream('deflate-raw')
// and stored instead when that is not smaller. No ZIP64: the writer refuses what needs it.
import { AfterlifeError } from '../errors';
import { crc32 } from './crc32';

export interface ZipInput {
  /** `/`-separated, as it goes into the archive. */
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface WriteZipOptions {
  /** The entries' modification time, local; default 1980-01-01 00:00 (deterministic output). */
  readonly date?: Date;
}

const MAX_U32 = 0xffffffff;

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function dosTime(d: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export async function writeZip(
  entries: readonly ZipInput[],
  options: WriteZipOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (entries.length > 0xffff) throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'zip64' });
  const { time, date } = dosTime(options.date ?? new Date(1980, 0, 1));
  const utf8 = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = utf8.encode(e.name);
    const crc = crc32(e.bytes);
    const packed = await deflate(e.bytes);
    const stored = packed.length >= e.bytes.length;
    const data = stored ? e.bytes : packed;
    if (e.bytes.length > MAX_U32 || offset > MAX_U32)
      throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'zip64' });
    const head = new Uint8Array(30 + name.length);
    const h = new DataView(head.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true); // version needed: 2.0 (deflate)
    h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint16(8, stored ? 0 : 8, true);
    h.setUint16(10, time, true);
    h.setUint16(12, date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, e.bytes.length, true);
    h.setUint16(26, name.length, true);
    head.set(name, 30);

    const dir = new Uint8Array(46 + name.length);
    const c = new DataView(dir.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // made by: MS-DOS, 2.0
    dir.set(head.subarray(4, 30), 6); // version needed … name length, as in the local header
    c.setUint32(42, offset, true);
    dir.set(name, 46);

    parts.push(head, data);
    central.push(dir);
    offset += head.length + data.length;
  }
  const size = central.reduce((n, d) => n + d.length, 0);
  if (offset > MAX_U32) throw new AfterlifeError('UNSUPPORTED_ZIP', { feature: 'zip64' });
  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, entries.length, true);
  v.setUint16(10, entries.length, true);
  v.setUint32(12, size, true);
  v.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const p of [...parts, ...central, end]) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
