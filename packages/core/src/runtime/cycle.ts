// Spec 04 R2.1, R2.2, design D12: the bounded fixpoint loop. Generic over its steps, so P7 runs
// the same loop the session does. A pass runs each step whose reads meet the nodes changed so far
// (the last pass's changes plus this pass's), in order: field-change rules, then calculations in
// dependency order. The loop ends when a pass changes nothing, or after MAX_PASSES.

export const MAX_PASSES = 16;

export interface Change<N = unknown> {
  readonly id: string;
  readonly node: N;
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

/** Changed nodes by field id. */
export type Dirty<N> = ReadonlyMap<string, readonly N[]>;

export interface Step<N> {
  readonly id: string;
  readonly reads: ReadonlySet<string>;
  run(dirty: Dirty<N>): readonly Change<N>[];
}

export interface CycleResult<N> {
  readonly changes: readonly Change<N>[];
  readonly passes: number;
  /** R2.2: field ids still changing when the cap stopped the loop. */
  readonly loop?: readonly string[];
}

export function runCycle<N>(
  steps: readonly Step<N>[],
  seed: Dirty<N>,
  max = MAX_PASSES,
): CycleResult<N> {
  const changes: Change<N>[] = [];
  let dirty: Map<string, N[]> = new Map([...seed].map(([k, v]) => [k, [...v]]));
  let passes = 0;
  while (dirty.size > 0 && passes < max) {
    passes++;
    const seen = new Map(dirty);
    const next = new Map<string, N[]>();
    for (const s of steps) {
      if (![...s.reads].some((r) => seen.has(r))) continue;
      for (const c of s.run(seen)) {
        changes.push(c);
        for (const m of [seen, next]) {
          const list = m.get(c.id);
          if (!list) m.set(c.id, [c.node]);
          else if (!list.includes(c.node)) m.set(c.id, [...list, c.node]);
        }
      }
    }
    dirty = next;
  }
  return dirty.size > 0 ? { changes, passes, loop: [...dirty.keys()] } : { changes, passes };
}
