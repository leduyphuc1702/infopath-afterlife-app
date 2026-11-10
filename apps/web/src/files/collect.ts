// Spec 09 R1.1, R1.2: what the user dropped or picked. Folders are walked; `.xsn` and `.xml`
// (any case) go to the Worker, anything else is listed as not opened. Sizes are checked before a
// byte is read: core's `inputBytes` (20 MiB) for a template, `xmlBytes` (4 MiB) for a record.
import type { WireError } from '../worker/protocol';

const MiB = 1024 * 1024;
/** Core's DEFAULT_LIMITS (the main thread imports core types only, design §1). */
export const XSN_MAX_BYTES = 20 * MiB;
export const XML_MAX_BYTES = 4 * MiB;
export const MAX_FILES = 1_000;

export interface Collected {
  readonly files: readonly File[];
  readonly ignored: readonly string[];
  readonly rejected: readonly { readonly fileName: string; readonly error: WireError }[];
  /** Set when more than MAX_FILES arrived: nothing from the batch is opened. */
  readonly tooMany?: WireError;
}

const extOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

export function sortInput(input: readonly File[]): Collected {
  if (input.length > MAX_FILES)
    return {
      files: [],
      ignored: [],
      rejected: [],
      tooMany: { code: 'TOO_MANY_FILES', details: { max: MAX_FILES, observed: input.length } },
    };
  const files: File[] = [];
  const ignored: string[] = [];
  const rejected: { fileName: string; error: WireError }[] = [];
  for (const f of input) {
    const ext = extOf(f.name);
    if (ext !== 'xsn' && ext !== 'xml') {
      ignored.push(f.name);
      continue;
    }
    const max = ext === 'xsn' ? XSN_MAX_BYTES : XML_MAX_BYTES;
    if (f.size > max)
      rejected.push({
        fileName: f.name,
        error: { code: 'FILE_TOO_LARGE', details: { max, observed: f.size } },
      });
    else files.push(f);
  }
  return { files, ignored, rejected };
}

type Entry = FileSystemEntry;
const isFile = (e: Entry): e is FileSystemFileEntry => e.isFile;
const isDir = (e: Entry): e is FileSystemDirectoryEntry => e.isDirectory;

async function walk(entry: Entry, out: File[]): Promise<void> {
  if (isFile(entry)) {
    out.push(await new Promise<File>((resolve, reject) => entry.file(resolve, reject)));
  } else if (isDir(entry)) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise<Entry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (batch.length === 0) break;
      for (const e of batch) await walk(e, out);
    }
  }
}

/** The files of a drop, folders walked; falls back to `files` when entries are not available. */
export async function fromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries = [...dt.items]
    .filter((i) => i.kind === 'file')
    .map((i) => i.webkitGetAsEntry())
    .filter((e): e is Entry => e !== null);
  if (entries.length === 0) return [...dt.files];
  const out: File[] = [];
  for (const e of entries) await walk(e, out);
  return out;
}
