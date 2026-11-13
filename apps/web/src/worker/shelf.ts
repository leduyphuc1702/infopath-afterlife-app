// The library between visits: IndexedDB, in this browser only. The Worker reads and writes it;
// nothing leaves the computer. Not written by Kiro (README, "What Kiro did not write").
import type { Shelf, ShelfFile } from './session';

const STORE = 'files';

export function idbShelf(name = 'afterlife-library'): Shelf {
  let db: Promise<IDBDatabase> | undefined;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'hash' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = r.onblocked = () => reject(r.error ?? new Error('IndexedDB'));
    }));
  const run = async <T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>) => {
    const t = (await open()).transaction(STORE, mode);
    const r = work(t.objectStore(STORE));
    return new Promise<T>((resolve, reject) => {
      t.oncomplete = () => resolve(r.result);
      t.onerror = t.onabort = () => reject(t.error ?? new Error('IndexedDB'));
    });
  };
  return {
    all: () => run('readonly', (s) => s.getAll() as IDBRequest<ShelfFile[]>),
    put: async (files) => {
      await run('readwrite', (s) => files.map((f) => s.put(f)).at(-1)!);
    },
    remove: async (hashes) => {
      await run('readwrite', (s) => hashes.map((h) => s.delete(h)).at(-1)!);
    },
  };
}
