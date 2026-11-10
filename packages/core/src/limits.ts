// Resource limits (R4, D7). Every limit is an option; these are the defaults (R4.6).
// 1 MB here is 1,048,576 bytes.

const MB = 1024 * 1024;

export interface Limits {
  /** Largest accepted input (R4.3). */
  readonly inputBytes: number;
  /** Largest declared or actual uncompressed total (R4.1). */
  readonly uncompressedBytes: number;
  /** Most CFFILE entries a cabinet may declare (R4.2). */
  readonly entries: number;
  /** Deepest element nesting in one XML document (R4.5). */
  readonly xmlDepth: number;
  /** Total XML bytes parsed across the package (D7). */
  readonly xmlBytes: number;
}

export const DEFAULT_LIMITS: Limits = Object.freeze({
  inputBytes: 20 * MB,
  uncompressedBytes: 50 * MB,
  entries: 2_000,
  xmlDepth: 256,
  xmlBytes: 4 * MB,
});

export interface ParseOptions {
  readonly limits?: Partial<Limits>;
}

/** Defaults with the given overrides; `undefined` values keep the default. */
export function resolveLimits(overrides?: Partial<Limits>): Limits {
  const out: Record<keyof Limits, number> = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS) as (keyof Limits)[]) {
    const value = overrides?.[key];
    if (value !== undefined) out[key] = value;
  }
  return Object.freeze(out);
}
