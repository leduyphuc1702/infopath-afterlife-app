// Resource limits (R4, D7). Every limit is an option; these are the defaults (R4.6).
// Sizes are binary: 1 MiB is 1,048,576 bytes.

const MiB = 1024 * 1024;

export interface Limits {
  /** Largest accepted input (R4.3). */
  readonly inputBytes: number;
  /** Largest declared or actual uncompressed total (R4.1). */
  readonly uncompressedBytes: number;
  /** Most CFFILE entries a cabinet may declare (R4.2). */
  readonly entries: number;
  /** Most CFDATA blocks across all folders, from the CFFOLDER counts (R4.7). */
  readonly blocks: number;
  /** Deepest element nesting in one XML document (R4.5). */
  readonly xmlDepth: number;
  /** Total XML bytes parsed across the package (D7). */
  readonly xmlBytes: number;
}

export const DEFAULT_LIMITS: Limits = Object.freeze({
  inputBytes: 20 * MiB,
  uncompressedBytes: 50 * MiB,
  entries: 2_000,
  blocks: 4_096,
  xmlDepth: 256,
  xmlBytes: 4 * MiB,
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

/** Spec 03 design §6: what one render may do. Every limit is an option of `renderView`. */
export interface RenderLimits {
  /** Nested template calls, built-in rule calls and `xdMath:Eval` calls. */
  readonly templateDepth: number;
  /** Per instruction 1; per XPath step 1 + nodes; per string result ceil(length / 16). */
  readonly evaluationSteps: number;
  /** Characters added to any result tree, the main one or a variable's, plus 64 per node. */
  readonly outputBytes: number;
}

export const DEFAULT_RENDER_LIMITS: RenderLimits = Object.freeze({
  templateDepth: 128,
  evaluationSteps: 200_000,
  outputBytes: 4 * MiB,
});

/** Defaults with the given overrides; `undefined` values keep the default. */
export function resolveRenderLimits(overrides?: Partial<RenderLimits>): RenderLimits {
  const out: Record<keyof RenderLimits, number> = { ...DEFAULT_RENDER_LIMITS };
  for (const key of Object.keys(DEFAULT_RENDER_LIMITS) as (keyof RenderLimits)[]) {
    const value = overrides?.[key];
    if (value !== undefined) out[key] = value;
  }
  return Object.freeze(out);
}
