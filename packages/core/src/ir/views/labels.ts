// Stage 6: labels (spec 02 R5). Task 2 provides step 8 (Title Case of the name) only.

/** Split at `_`, `-`, `.` and lower-to-upper changes; capitalise each word; keep capital runs. */
export function titleCase(name: string): string {
  const words = name
    .split(/[_.-]+/)
    .flatMap((w) => w.split(/(?<=[a-z])(?=[A-Z])/))
    .filter((w) => w !== '');
  return words.length ? words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ') : name;
}
