// Test-only MS-CAB writer (design §13.1). Builds cabinets from files with Node's zlib, with knobs
// for everything the reader must accept or refuse: blocks per folder, several folders, any
// compression type, header flags, reserve areas, wrong checksums and raw field overrides.
// MSZIP blocks are compressed with the previous ≤ 32 KB of folder output as a dictionary, so
// multi-block folders really depend on carried history (R1.2).

import { deflateRawSync } from 'node:zlib';

export interface WriterFile {
  name: string;
  bytes: Uint8Array;
  /** CFFILE attribs; `0x80` makes the name UTF-8. Default `0x20`. */
  attributes?: number;
  /** Folder index. Default 0. */
  folder?: number;
  date?: number;
  time?: number;
  /** Raw name bytes (without the NUL), instead of encoding `name`. */
  nameBytes?: Uint8Array;
}

export interface FolderSpec {
  /** `'mszip'` (default), `'none'`, or a raw `typeCompress` value (stored bytes are written). */
  compression?: 'none' | 'mszip' | number;
  /** Uncompressed bytes per block. Default `options.blockSize`, else 32,768. */
  blockSize?: number;
  /**
   * Explicit blocks, written as given instead of the folder's file data (`ab` includes `CK` for
   * MSZIP). For cabinets whose output would be too large to build from files.
   */
  blocks?: { ab: Uint8Array; cbUncomp: number }[];
}

export interface HeaderFields {
  signature: number;
  reserved1: number;
  cbCabinet: number;
  reserved2: number;
  coffFiles: number;
  reserved3: number;
  versionMinor: number;
  versionMajor: number;
  cFolders: number;
  cFiles: number;
  flags: number;
  setID: number;
  iCabinet: number;
}

export interface FolderFields {
  coffCabStart: number;
  cCFData: number;
  typeCompress: number;
}

export interface FileFields {
  cbFile: number;
  uoffFolderStart: number;
  iFolder: number;
  date: number;
  time: number;
  attribs: number;
}

export interface BlockFields {
  csum: number;
  cbData: number;
  cbUncomp: number;
  /** The block's data bytes, `CK` included for MSZIP. */
  ab: Uint8Array;
}

export interface WriterOptions {
  folders?: FolderSpec[];
  blockSize?: number;
  /** Header flags. `0x0004` is added when `reserve` is given. */
  flags?: number;
  /** Reserve sizes; any of them sets flag `0x0004`. Reserve bytes are filled with `0xAA`. */
  reserve?: { header?: number; folder?: number; data?: number };
  /** `'valid'` (default) computes CFDATA checksums; `'zero'` writes 0. */
  checksums?: 'valid' | 'zero';
  header?: Partial<HeaderFields>;
  folderFields?: Record<number, Partial<FolderFields>>;
  fileFields?: Record<number, Partial<FileFields>>;
  /** Keyed by `"<folder>:<block>"`. A changed `ab` changes `cbData` and the checksum too. */
  blockFields?: Record<string, Partial<BlockFields>>;
}

export interface CabinetLayout {
  /** End of CFHEADER, including its reserve and strings. */
  headerEnd: number;
  /** Offset of each CFFOLDER entry. */
  folders: number[];
  /** Offset of each CFFILE entry. */
  files: number[];
  /** Offset of each CFDATA header, per folder. */
  blocks: number[][];
}

export interface WrittenCabinet {
  bytes: Uint8Array;
  layout: CabinetLayout;
}

const WINDOW = 32_768;
const MSCF = 0x4643534d;

export function writeCabinet(files: WriterFile[], options: WriterOptions = {}): WrittenCabinet {
  const reserve = options.reserve;
  const flags = (options.flags ?? 0) | (reserve ? 0x0004 : 0);
  const cbCFHeader = reserve?.header ?? 0;
  const cbCFFolder = reserve?.folder ?? 0;
  const cbCFData = reserve?.data ?? 0;

  const folderCount = Math.max(
    options.folders?.length ?? 0,
    ...files.map((f) => (f.folder ?? 0) + 1),
    1,
  );
  const specs = Array.from({ length: folderCount }, (_, i) => options.folders?.[i] ?? {});

  // Folder contents, in file order, and each file's offset in its folder.
  const folderData: number[][] = specs.map(() => []);
  const uoff: number[] = [];
  for (const f of files) {
    const data = folderData[f.folder ?? 0]!;
    uoff.push(data.length);
    for (const b of f.bytes) data.push(b);
  }

  const blocks: BlockFields[][] = specs.map((spec, fi) =>
    makeBlocks(
      Uint8Array.from(folderData[fi]!),
      spec,
      options.blockSize ?? WINDOW,
      fi,
      options.blockFields ?? {},
    ),
  );

  const names = files.map((f) => f.nameBytes ?? encodeName(f.name, f.attributes ?? 0x20));
  const strings: Uint8Array[] = [];
  if (flags & 0x0001) strings.push(ascii('prev.cab'), ascii('Disk 1'));
  if (flags & 0x0002) strings.push(ascii('next.cab'), ascii('Disk 2'));

  const headerEnd =
    36 + (flags & 0x0004 ? 4 + cbCFHeader : 0) + strings.reduce((n, s) => n + s.length + 1, 0);
  const folderEntry = 8 + cbCFFolder;
  const coffFiles = headerEnd + folderCount * folderEntry;
  const filesEnd = coffFiles + names.reduce((n, s) => n + 16 + s.length + 1, 0);

  const layout: CabinetLayout = { headerEnd, folders: [], files: [], blocks: [] };
  let at = filesEnd;
  const coffCabStart: number[] = [];
  for (const fb of blocks) {
    coffCabStart.push(at);
    const offs: number[] = [];
    for (const b of fb) {
      offs.push(at);
      at += 8 + cbCFData + b.ab.length;
    }
    layout.blocks.push(offs);
  }
  const total = at;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  const header: HeaderFields = {
    signature: MSCF,
    reserved1: 0,
    cbCabinet: total,
    reserved2: 0,
    coffFiles,
    reserved3: 0,
    versionMinor: 3,
    versionMajor: 1,
    cFolders: folderCount,
    cFiles: files.length,
    flags,
    setID: 0x1234,
    iCabinet: 0,
    ...options.header,
  };
  view.setUint32(0, header.signature, true);
  view.setUint32(4, header.reserved1, true);
  view.setUint32(8, header.cbCabinet, true);
  view.setUint32(12, header.reserved2, true);
  view.setUint32(16, header.coffFiles, true);
  view.setUint32(20, header.reserved3, true);
  view.setUint8(24, header.versionMinor);
  view.setUint8(25, header.versionMajor);
  view.setUint16(26, header.cFolders, true);
  view.setUint16(28, header.cFiles, true);
  view.setUint16(30, header.flags, true);
  view.setUint16(32, header.setID, true);
  view.setUint16(34, header.iCabinet, true);
  let p = 36;
  if (flags & 0x0004) {
    view.setUint16(36, cbCFHeader, true);
    view.setUint8(38, cbCFFolder);
    view.setUint8(39, cbCFData);
    out.fill(0xaa, 40, 40 + cbCFHeader);
    p = 40 + cbCFHeader;
  }
  for (const s of strings) {
    out.set(s, p);
    p += s.length + 1;
  }

  for (let fi = 0; fi < folderCount; fi++) {
    const spec = specs[fi]!;
    const fields: FolderFields = {
      coffCabStart: coffCabStart[fi]!,
      cCFData: blocks[fi]!.length,
      typeCompress: compressionType(spec),
      ...options.folderFields?.[fi],
    };
    layout.folders.push(p);
    view.setUint32(p, fields.coffCabStart, true);
    view.setUint16(p + 4, fields.cCFData, true);
    view.setUint16(p + 6, fields.typeCompress, true);
    out.fill(0xaa, p + 8, p + folderEntry);
    p += folderEntry;
  }

  files.forEach((f, i) => {
    const fields: FileFields = {
      cbFile: f.bytes.length,
      uoffFolderStart: uoff[i]!,
      iFolder: f.folder ?? 0,
      date: f.date ?? 0x5b6a,
      time: f.time ?? 0x6000,
      attribs: f.attributes ?? 0x20,
      ...options.fileFields?.[i],
    };
    layout.files.push(p);
    view.setUint32(p, fields.cbFile, true);
    view.setUint32(p + 4, fields.uoffFolderStart, true);
    view.setUint16(p + 8, fields.iFolder, true);
    view.setUint16(p + 10, fields.date, true);
    view.setUint16(p + 12, fields.time, true);
    view.setUint16(p + 14, fields.attribs, true);
    out.set(names[i]!, p + 16);
    p += 16 + names[i]!.length + 1;
  });

  blocks.forEach((fb, fi) => {
    fb.forEach((b, bi) => {
      const o = layout.blocks[fi]![bi]!;
      view.setUint16(o + 4, b.cbData, true);
      view.setUint16(o + 6, b.cbUncomp, true);
      out.fill(0xaa, o + 8, o + 8 + cbCFData);
      out.set(b.ab, o + 8 + cbCFData);
      const override = options.blockFields?.[`${fi}:${bi}`]?.csum;
      const csum =
        override ??
        (options.checksums === 'zero'
          ? 0
          : msCabChecksum(out.subarray(o + 4, o + 8 + cbCFData), msCabChecksum(b.ab, 0)));
      view.setUint32(o, csum, true);
    });
  });

  return { bytes: out, layout };
}

function makeBlocks(
  data: Uint8Array,
  spec: FolderSpec,
  defaultSize: number,
  folder: number,
  overrides: Record<string, Partial<BlockFields>>,
): BlockFields[] {
  const size = spec.blockSize ?? defaultSize;
  const type = compressionType(spec) & 0x000f;
  const out: BlockFields[] = [];
  if (spec.blocks) {
    return spec.blocks.map((b) => ({
      csum: 0,
      cbData: b.ab.length,
      cbUncomp: b.cbUncomp,
      ab: b.ab,
    }));
  }
  for (let at = 0, i = 0; at < data.length; at += size, i++) {
    const chunk = data.subarray(at, at + size);
    let ab: Uint8Array = chunk;
    if (type === 1) {
      const history = data.subarray(Math.max(0, at - WINDOW), at);
      const deflated = deflateRawSync(chunk, history.length ? { dictionary: history } : {});
      ab = new Uint8Array([0x43, 0x4b, ...deflated]);
    }
    const o = overrides[`${folder}:${i}`] ?? {};
    const finalAb = o.ab ?? ab;
    out.push({
      csum: 0,
      cbData: o.cbData ?? finalAb.length,
      cbUncomp: o.cbUncomp ?? chunk.length,
      ab: finalAb,
    });
  }
  return out;
}

function compressionType(spec: FolderSpec): number {
  const c = spec.compression ?? 'mszip';
  return c === 'mszip' ? 1 : c === 'none' ? 0 : c;
}

function encodeName(name: string, attributes: number): Uint8Array {
  if (attributes & 0x80) return new TextEncoder().encode(name);
  const out = new Uint8Array(name.length);
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    if (c > 0x7f) throw new Error('non-ASCII names without 0x80 need nameBytes');
    out[i] = c;
  }
  return out;
}

function ascii(s: string): Uint8Array {
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
}

/**
 * MS-CAB checksum, written independently of src/cab/checksum.ts: XOR of little-endian u32
 * words, with the 1–3 trailing bytes packed high byte first. The CFDATA checksum is this over
 * `ab`, then over the header bytes from `cbData` to the end of the data reserve.
 */
export function msCabChecksum(bytes: Uint8Array, seed: number): number {
  let sum = seed >>> 0;
  const words = bytes.length >>> 2;
  for (let i = 0; i < words; i++) {
    const j = i * 4;
    sum ^= (bytes[j]! | (bytes[j + 1]! << 8) | (bytes[j + 2]! << 16) | (bytes[j + 3]! << 24)) >>> 0;
  }
  let tail = 0;
  let j = words * 4;
  switch (bytes.length & 3) {
    case 3:
      tail |= bytes[j++]! << 16;
    // falls through
    case 2:
      tail |= bytes[j++]! << 8;
    // falls through
    case 1:
      tail |= bytes[j]!;
  }
  return (sum ^ tail) >>> 0;
}
