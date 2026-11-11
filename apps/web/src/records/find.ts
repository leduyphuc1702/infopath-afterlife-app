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
  /** Spec 28 R2: number and date columns' text as the record holds it. */
  readonly stored?: readonly string[];
  /** Spec 28 R3: beside each `more` entry, its stored text for a number or date, else ''. */
  readonly moreStored?: readonly string[];
}

/**
 * Spec 28 R1–R3: Find also reads the text a number or date holds in the record, in columns and
 * in repeating rows. Text and check boxes match on what is shown only, so `true` does not find
 * every ticked box.
 */
export const searchText = (rows: readonly Findable[], skip: number) =>
  rows.map((r) =>
    [
      ...r.cells.filter((_c, i) => i !== skip),
      ...(r.stored ?? []),
      ...(r.more ?? []),
      ...(r.moreStored ?? []).filter((m) => m !== ''),
    ]
      .join('\u0000')
      .toLowerCase(),
  );

/** Spec 19 R2: where a row matched, when no shown cell holds the text. */
export function whereFound(row: Findable, query: string, skip: number): string | undefined {
  const q = query.trim().toLowerCase();
  const has = (c: string | undefined) => c !== undefined && c.toLowerCase().includes(q);
  if (q === '' || row.cells.some((c, i) => i !== skip && has(c)) || row.stored?.some(has)) return;
  // R3: the line says the entry as shown, whichever of its two texts held the match.
  return row.more?.find((m, j) => has(m) || has(row.moreStored?.[j]));
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
