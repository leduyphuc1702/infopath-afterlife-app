// Spec 09 R1.2, ux-principles.md 5: every error the user can see has three parts. The record
// type lists every core ErrorCode and every app code, so a new code fails the type check.
import type { ErrorCode } from '@afterlife/core';
import type { AppCode, WireError } from './worker/protocol';

export interface Message {
  readonly what: string;
  readonly why: string;
  readonly action: string;
}

type Details = Readonly<Record<string, unknown>>;
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const size = (v: unknown) => {
  const n = typeof v === 'number' ? v : 0;
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
};
const SAVE_AGAIN = 'Save the form again from SharePoint or InfoPath, then drop the new copy here.';
const REPORT =
  'Try the file again. If it keeps happening, report it with the file name (not the file).';

export const MESSAGES: {
  readonly [C in ErrorCode | AppCode]: (d: Details, file: string) => Message;
} = {
  UNSUPPORTED_COMPRESSION: (d, f) => ({
    what: `We couldn't open ${f}.`,
    why: `It is compressed with ${str(d.method)}, which this viewer does not read.`,
    action: SAVE_AGAIN,
  }),
  UNSUPPORTED_CAB: (_d, f) => ({
    what: `We couldn't open ${f}.`,
    why: 'It is one part of a template split across several files.',
    action: 'Drop the complete template, saved as one .xsn file.',
  }),
  CORRUPT_CAB: (_d, f) => ({
    what: `We couldn't open ${f}.`,
    why: "The file is damaged: its cabinet structure doesn't add up.",
    action: SAVE_AGAIN,
  }),
  LIMIT_EXCEEDED: (d, f) => ({
    what: `We stopped reading ${f}.`,
    why: `It goes past a safety limit (${str(d.limit)}: ${str(d.observed)}, the most is ${str(d.max)}).`,
    action: 'If this is a real form, open it in a smaller part, or report the limit to us.',
  }),
  MISSING_MANIFEST: (_d, f) => ({
    what: `${f} is not an InfoPath template.`,
    why: 'It has no manifest.xsf, the file every InfoPath template starts from.',
    action: 'Check that you dropped the .xsn file of the form.',
  }),
  UNSAFE_XML: (d, f) => ({
    what: `We didn't open ${f}.`,
    why: `${str(d.file) || 'An XML file'} declares a DOCTYPE, which can be used to read other files.`,
    action: 'Open the file in a text editor and check where it came from.',
  }),
  INVALID_XML: (d, f) => ({
    what: `We couldn't read ${f}.`,
    why: `${str(d.file) || 'The XML'} is not well formed at line ${str(d.line)}, column ${str(d.column)}.`,
    action: 'Open it in a text editor at that line, or save it again from InfoPath.',
  }),
  INTERNAL: (_d, f) => ({
    what: `Something went wrong with ${f}.`,
    why: 'The viewer reached a state it should never reach.',
    action: REPORT,
  }),
  INVALID_IR: (_d, f) => ({
    what: `Something went wrong with ${f}.`,
    why: 'The viewer could not read its own description of the form.',
    action: REPORT,
  }),
  UNSUPPORTED_IR_VERSION: (_d, f) => ({
    what: `Something went wrong with ${f}.`,
    why: 'The form was described by another version of this viewer.',
    action: 'Reload the page and drop the .xsn again.',
  }),
  RENDER_FAILED: (d, f) => ({
    what: `We couldn't draw the ${str(d.view)} view of ${f}.`,
    why: `The view's XSL stopped with ${str(d.xsltCode)}: ${str(d.message).replace(/[^.!?]$/, '$&.')}`,
    action: 'Choose another view, or look at the fields and connections, which still work.',
  }),
  VIEW_NOT_RENDERABLE: (d, f) => ({
    what: `We couldn't draw the ${str(d.view) || 'default'} view of ${f}.`,
    why:
      d.reason === 'missing'
        ? "Its XSL file isn't in the template."
        : 'Its XSL file could not be read.',
    action: 'Choose another view, or look at the fields and connections, which still work.',
  }),
  INVALID_RENDER_INPUT: (_d, f) => ({
    what: `We couldn't draw ${f}.`,
    why: 'The template has no empty form to start from.',
    action: 'Drop a filled-in record of this form to see it.',
  }),
  CORRUPT_ZIP: (_d, f) => ({
    what: `We couldn't open ${f}.`,
    why: 'The .zip file is damaged, or one of its file names points outside the archive.',
    action: 'Download or zip the files again, then drop the new copy here.',
  }),
  UNSUPPORTED_ZIP: (d, f) => ({
    what: `We couldn't open ${f}.`,
    why:
      d.feature === 'encryption'
        ? 'The .zip file is protected with a password.'
        : d.feature === 'zip64'
          ? 'The .zip file is larger than 4 GB, or holds more than 65,535 files.'
          : d.feature === 'multiDisk'
            ? 'The .zip file is one part of an archive split across several files.'
            : `It is compressed with a method this viewer does not read (${str(d.method)}).`,
    action: 'Make a plain .zip of the .xsn and .xml files, or drop the files themselves.',
  }),
  FILE_TOO_LARGE: (d, f) => ({
    what: `We didn't open ${f}.`,
    why: `It is ${size(d.observed)}; the most this viewer opens is ${size(d.max)}.`,
    action: 'Check that it is an InfoPath file. Real templates and records are far smaller.',
  }),
  TOO_MANY_FILES: (d) => ({
    what: `We didn't open the ${str(d.observed)} files.`,
    why: `The most this viewer opens at once is ${str(d.max)}.`,
    action: 'Drop the templates first, then the records in smaller folders.',
  }),
  FILL_PATH: (d) =>
    d.reason === 'lastRow'
      ? {
          what: "That row wasn't removed.",
          why: 'The form needs at least one row in this table.',
          action: 'Clear the values in the row instead.',
        }
      : d.reason === 'notGroup'
        ? {
            what: "That row or section wasn't changed.",
            why: "It is no longer on the form, or the form doesn't allow adding or removing it.",
            action: 'Check the table or section and try again.',
          }
        : {
            what: "That change wasn't made.",
            why: 'The field it was for is no longer on the form, or it is worked out from other fields.',
            action: 'Check the field and type the value again.',
          },
  FILL_STATE: (d) => ({
    what: "This record can't be filled in.",
    why:
      d.reason === 'version'
        ? 'It was made with another version of the form, so its fields may not match.'
        : 'The fill session ended, for example after the background worker restarted.',
    action:
      d.reason === 'version'
        ? 'Open the matching version of the template, or fill in the empty form.'
        : 'Turn Fill on again. Download the XML first next time to keep your changes.',
  }),
  WORKER_TIMEOUT: (_d, f) => ({
    what: `${f || 'The last request'} took too long.`,
    why: 'The background worker gave no answer in 15 seconds, so we restarted it.',
    action: 'Try again. Your open files are still here.',
  }),
  WORKER_FAILED: (_d, f) => ({
    what: `Something went wrong with ${f || 'the last request'}.`,
    why: 'The background worker stopped with an unexpected error.',
    action: REPORT,
  }),
};

export const messageOf = (e: WireError, file = ''): Message => MESSAGES[e.code](e.details, file);
