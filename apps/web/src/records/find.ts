// Spec 17 R5, R7, R10: which records the list shows, in what order, and the walk through them.
import type { ListKey } from '@afterlife/core';

export interface Sort {
  readonly column: number;
  readonly descending: boolean;
}

export interface Findable {
  readonly cells: readonly string[];
  readonly keys: readonly ListKey[];
}

/** Each row's searchable text, made once per list. Failed checks (the last cell) are left out. */
export const searchText = (rows: readonly Findable[]) =>
  rows.map((r) => r.cells.slice(0, -1).join('\u0000').toLowerCase());

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const compare = (a: ListKey, b: ListKey): number =>
  typeof a === 'number' && typeof b === 'number'
    ? a - b
    : typeof a === 'number'
      ? -1
      : typeof b === 'number'
        ? 1
        : collator.compare(a ?? '', b ?? '');

/** The indices of the rows shown: matching `query`, ordered by `sort`, empty last, ties stable. */
export function findRows(
  rows: readonly Findable[],
  text: readonly string[],
  query: string,
  sort?: Sort,
): number[] {
  const q = query.trim().toLowerCase();
  const shown: number[] = [];
  for (let i = 0; i < rows.length; i++) if (q === '' || text[i]!.includes(q)) shown.push(i);
  if (!sort) return shown;
  const { column, descending } = sort;
  return shown.sort((i, j) => {
    const a = rows[i]!.keys[column] ?? null;
    const b = rows[j]!.keys[column] ?? null;
    if (a === null || b === null) return a === b ? i - j : a === null ? 1 : -1;
    const c = compare(a, b);
    return (descending ? -c : c) || i - j;
  });
}

/** R10: the neighbour of `current` in `order`, or undefined at either end or outside it. */
export function walkStep<T>(order: readonly T[], current: T, step: -1 | 1): T | undefined {
  const i = order.indexOf(current);
  return i < 0 ? undefined : order[i + step];
}
