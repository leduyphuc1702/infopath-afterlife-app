// Spec 17 R5, R7, R10: which records the list shows, in what order, and the walk through them.
import type { ListKey } from '@afterlife/core';

export interface Sort {
  readonly column: number;
  readonly descending: boolean;
}

export interface Findable {
  readonly cells: readonly string[];
  readonly keys: readonly ListKey[];
  /** Spec 19 R2: values in repeating rows, "Label: value". */
  readonly more?: readonly string[];
}

/** Each row's searchable text, made once per list; the cell at `skip` (Failed checks) is not. */
export const searchText = (rows: readonly Findable[], skip: number) =>
  rows.map((r) =>
    [...r.cells.filter((_c, i) => i !== skip), ...(r.more ?? [])].join('\u0000').toLowerCase(),
  );

/** Spec 19 R2: where a row matched, when no shown cell holds the text. */
export function whereFound(row: Findable, query: string, skip: number): string | undefined {
  const q = query.trim().toLowerCase();
  if (q === '' || row.cells.some((c, i) => i !== skip && c.toLowerCase().includes(q))) return;
  return row.more?.find((m) => m.toLowerCase().includes(q));
}

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
