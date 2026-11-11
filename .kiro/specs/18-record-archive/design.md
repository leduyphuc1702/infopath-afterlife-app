# Spec 18 design

1. **Core, `legacy/archive.ts`: `archiveRecords(t, ir, records, options)`**, async, pure bytes
   out. Options: `views` (`{ name, caption, prepared }`, prepared by the caller, so the Worker's
   cache is reused), `now` (render time and foot), `fileName` (the `.xsn`), `date` (zip times),
   `progress`, `cancelled()` (polled before each record), `css` (the page's read-mode rules).
   - Files: `recordTables` (the export's attachment naming); the index: `recordList` (spec 17).
   - Pages: `renderView` per record and view; the root's `inert` is dropped, so the page can be
     searched and selected, and an archive rule makes controls inert to the pointer instead.
     Name: `<record>.html`, or `<record> - <view>.html` with two or more views (`safeSegment`).
     Two records with the same base get " (2)" as the export does.
   - Every text and attribute we write goes through one `esc`; hrefs through `encodeURIComponent`
     per segment. The rendered `html` and `css` are core's sanitised output (spec 03), as is.
   - A page that fails to render holds the error's message as text; it counts as unread.
   - It yields to the event loop every 50 ms, so a cancel message is read; cancelled → `undefined`.
   - `writeZip` writes the entries. Returns `{ bytes, records, pages, files, unread }`.
2. **Head of every `.html`:** `default-src 'none'; style-src 'unsafe-inline'; img-src data:;
   base-uri 'none'; form-action 'none'`, `<meta name="referrer" content="no-referrer">`.
3. **Worker:** request `archive { templateId, views, recordIds?, now }` (no ids: all records of
   the form, in file-name order); `cancel` is read at once, not queued, and sets a flag the
   archive polls. Answer `exported`, or `cancelled`. `css` is the page's `READ_CSS + PRINT_CSS`.
4. **Page:** `paper/ArchiveMenu.tsx`, a menu with one checkbox per view and "Archive"; used in
   the form toolbar and on the Records screen (with the shown order). Status as the export, plus
   a Cancel button beside the status line while archiving.

## Property

- **P21** (`packages/core/test/legacy/archive.test.ts`): for any hostile records of form 02
  (markup, `javascript:`, quotes, `on…=` text, `</style>` and odd characters in values and file
  names), every `.html` in the archive has no `<script`, no `on…=` attribute, no `<base`,
  `<meta http-equiv="refresh"`, `<iframe`, `<object`, `<embed` or `<link`, and every `href`,
  `src` and CSS `url()` is a `data:image/…` URL or a relative path to an entry of the archive.

## Defaults taken (cheap to change)

- The Carlito font is not in the archive: the page asks for Calibri and falls back to the
  browser's sans-serif. Pictures stay inline (`data:`) as on the paper, and are files too.
- Archive time is the person's local time with its UTC offset, e.g. "2026-11-11 14:45 (UTC+07:00)".
- Fill's unsaved edits are not archived: the archive is of the loaded records.
- Zip name: `<form file>-archive.zip`.
