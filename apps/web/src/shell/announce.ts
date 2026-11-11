// Spec 13 B3, B7, B10: the words of the notes, announcements and page titles.
const APP = 'InfoPath Afterlife';
/** The landing page's title, as `index.html` has it. */
export const LANDING_TITLE = `${APP}: open old InfoPath forms in your browser`;

const list = (names: readonly string[], max = 3) =>
  names.length <= max
    ? names.join(', ')
    : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;

/** B3: files whose bytes were already open. */
export function alreadyOpen(names: readonly string[]): string | undefined {
  if (names.length === 0) return undefined;
  if (names.length === 1) return `${names[0]} is already open, so it was not added again.`;
  return `${names.length} files are already open, so they were not added again: ${list(names)}.`;
}

/** B10: one drop's files not opened and records not matched, as the lists below name them. */
export function notOpened(ignored: readonly string[], unmatched: readonly string[]): string {
  return [
    ignored.length > 0 && `Files not opened: ${list(ignored)}.`,
    unmatched.length > 0 && `Records not matched: ${list(unmatched)}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export type TitleOf =
  | undefined
  | { readonly triage: number }
  | { readonly certificate: string }
  | { readonly form: string };

/** B7: the screen first, then the app. */
export function screenTitle(t: TitleOf): string {
  if (t === undefined) return LANDING_TITLE;
  const first =
    'triage' in t
      ? `Triage: ${t.triage} ${t.triage === 1 ? 'form' : 'forms'}`
      : 'certificate' in t
        ? `Death certificate: ${t.certificate}`
        : t.form;
  return `${first} · ${APP}`;
}

/** Spec 09 R12.4: what an export wrote, for the status line. */
export function exportedNotice(
  r: {
    readonly fileName: string;
    readonly records: number;
    readonly files: number;
    readonly unread: number;
  },
  format: 'xlsx' | 'csv',
): string {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [
    `Exported ${n(r.records, 'record', 'records')} to ${r.fileName}.`,
    r.files > 0 &&
      (format === 'xlsx'
        ? `${n(r.files, 'attachment or picture is', 'attachments and pictures are')} listed by path; the files themselves are in the CSV export (.zip).`
        : `${n(r.files, 'attachment or picture is', 'attachments and pictures are')} in its attachments folder.`),
    r.unread > 0 &&
      `${n(r.unread, 'record', 'records')} could not be read; see the Read error column.`,
  ]
    .filter(Boolean)
    .join(' ');
}
