// The snapshot form of a parser result (design §13.1, R16.4): bytes become `{ size, sha256 }`,
// object keys are sorted, arrays keep document order. Runs in Node and in a Worker (no Node
// imports; SHA-256 through `crypto.subtle`).
//
// Anything JSON would silently change or drop is refused with its path instead: `undefined`,
// NaN, ±Infinity, -0, functions, symbols, bigints, and every object that is not a plain object,
// an array or a Uint8Array (Map, Set, Date, class instances). So a golden file cannot hide a
// Map or Set order, and the JSON round trip is exact, which the Worker comparison relies on.

export type Snapshot = null | boolean | number | string | Snapshot[] | { [key: string]: Snapshot };

export async function snapshot(value: unknown): Promise<Snapshot> {
  return walk(value, '$');
}

/** The golden file text: two-space JSON and a final newline. */
export function goldenText(snap: Snapshot): string {
  return `${JSON.stringify(snap, null, 2)}\n`;
}

async function walk(value: unknown, path: string): Promise<Snapshot> {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) refuse(path, String(value));
    return value;
  }
  if (typeof value !== 'object') refuse(path, typeof value);
  if (value instanceof Uint8Array) return { sha256: await sha256(value), size: value.byteLength };
  if (Array.isArray(value)) {
    const out: Snapshot[] = [];
    for (const [i, item] of value.entries()) out.push(await walk(item, `${path}[${i}]`));
    return out;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    refuse(path, (value as { constructor?: { name?: string } }).constructor?.name ?? 'object');
  }
  const out: { [key: string]: Snapshot } = {};
  for (const key of Object.keys(value).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined) refuse(`${path}.${key}`, 'undefined');
    out[key] = await walk(v, `${path}.${key}`);
  }
  return out;
}

function refuse(path: string, what: string): never {
  throw new Error(`snapshot: ${what} at ${path} has no exact JSON form`);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  // The copy gives digest() the ArrayBuffer-backed view its type requires.
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}
