// Typed errors and issues (design §11). Fatal problems throw AfterlifeError; everything else is
// an Issue in the result. `message` is English for logs; the UI maps `code` to user text.

import type { Limits, RenderLimits } from './limits';

/** Detail fields per fatal error code. */
export interface ErrorDetailsByCode {
  UNSUPPORTED_COMPRESSION: { method: 'LZX' | 'Quantum' | number; folder: number };
  UNSUPPORTED_CAB: { feature: 'prevCabinet' | 'nextCabinet' };
  /** `otherOffset`: the start of the range an overlapping folder runs into (R3.7). */
  CORRUPT_CAB: { offset: number; reason: string; otherOffset?: number };
  /** `line` and `column`: where an `xmlDepth` overrun was found. */
  LIMIT_EXCEEDED: {
    limit: keyof Limits | keyof RenderLimits;
    max: number;
    observed: number;
    file?: string;
    line?: number;
    column?: number;
  };
  MISSING_MANIFEST: { names: string };
  UNSAFE_XML: { file: string; line: number; column: number };
  /** `reason`: set when the XML is well formed but is not what was expected (a manifest root). */
  INVALID_XML: { file: string; line: number; column: number; encoding?: string; reason?: string };
  /** A parser bug: `reason` says which invariant broke. */
  INTERNAL: { path: string; reason: string };
  /** Spec 02: JSON that is not a FormIR; `path` is a JSON path such as `$.fields[3].kind`. */
  INVALID_IR: { path: string; reason: string };
  /** Spec 02: an `irVersion` other than the one this build writes; rebuild from the `.xsn`. */
  UNSUPPORTED_IR_VERSION: { found: string };
  /**
   * Spec 03: the XSLT engine stopped. `xsltCode` is the engine's code (`XTSE0165`, …) or the name
   * of a JavaScript error it raised (`RangeError`).
   */
  RENDER_FAILED: { view: string; xsltCode: string; message: string; line?: number };
  /** Spec 03 R1.3: `view` as asked for ('' for the default view of a form with no views). */
  VIEW_NOT_RENDERABLE: { view: string; reason: 'unknown' | 'missing' | 'unparsed' };
  /** Spec 03 R1.4: an input that is not what `renderView` accepts. */
  INVALID_RENDER_INPUT: { field: 'now' | 'locale' | 'record'; value: string };
}

export type ErrorCode = keyof ErrorDetailsByCode;

export const ERROR_CODES: readonly ErrorCode[] = [
  'UNSUPPORTED_COMPRESSION',
  'UNSUPPORTED_CAB',
  'CORRUPT_CAB',
  'LIMIT_EXCEEDED',
  'MISSING_MANIFEST',
  'UNSAFE_XML',
  'INVALID_XML',
  'INTERNAL',
  'INVALID_IR',
  'UNSUPPORTED_IR_VERSION',
  'RENDER_FAILED',
  'VIEW_NOT_RENDERABLE',
  'INVALID_RENDER_INPUT',
];

export class AfterlifeError<C extends ErrorCode = ErrorCode> extends Error {
  override readonly name = 'AfterlifeError';
  readonly code: C;
  readonly details: Readonly<ErrorDetailsByCode[C]>;

  constructor(code: C, details: ErrorDetailsByCode[C]) {
    super(errorMessage(code, details));
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const at = (d: { file: string; line: number; column: number }) => `${d.file}:${d.line}:${d.column}`;

const MESSAGES: { [C in ErrorCode]: (d: ErrorDetailsByCode[C]) => string } = {
  UNSUPPORTED_COMPRESSION: (d) => `Folder ${d.folder} uses unsupported compression ${d.method}`,
  UNSUPPORTED_CAB: (d) => `Multi-cabinet sets are not supported (${d.feature})`,
  CORRUPT_CAB: (d) => `Corrupt cabinet at offset ${d.offset}: ${d.reason}`,
  LIMIT_EXCEEDED: (d) =>
    `Limit ${d.limit} exceeded: ${d.observed} > ${d.max}` +
    (d.file === undefined ? '' : ` in ${d.file}`) +
    (d.line === undefined ? '' : ` at ${d.line}:${d.column ?? 0}`),
  MISSING_MANIFEST: (d) => `No manifest found among: ${d.names}`,
  UNSAFE_XML: (d) => `Document type declaration refused at ${at(d)}`,
  INVALID_XML: (d) =>
    `Invalid XML at ${at(d)}` +
    (d.encoding === undefined ? '' : ` (encoding ${d.encoding})`) +
    (d.reason === undefined ? '' : `: ${d.reason}`),
  INTERNAL: (d) => `Internal error at ${d.path}: ${d.reason}`,
  INVALID_IR: (d) => `Not a FormIR at ${d.path}: ${d.reason}`,
  UNSUPPORTED_IR_VERSION: (d) =>
    `FormIR version ${d.found} is not supported; rebuild it from the .xsn`,
  RENDER_FAILED: (d) =>
    `View ${ascii(d.view)} failed to render (${ascii(d.xsltCode)})` +
    (d.line === undefined ? '' : ` at line ${d.line}`) +
    `: ${ascii(d.message)}`,
  VIEW_NOT_RENDERABLE: (d) =>
    `View ${ascii(d.view)} cannot be rendered: ` +
    { unknown: 'no such view', missing: 'its XSL is missing', unparsed: 'its XSL failed to parse' }[
      d.reason
    ],
  INVALID_RENDER_INPUT: (d) => `Render input ${d.field} is not valid: ${ascii(d.value)}`,
};

/** Messages are printable ASCII; engine text may quote the view, so other characters become '?'. */
const ascii = (text: string) => text.replace(/[^\x20-\x7e]/g, '?');

function errorMessage<C extends ErrorCode>(code: C, details: ErrorDetailsByCode[C]): string {
  return (MESSAGES[code] as (d: ErrorDetailsByCode[C]) => string)(details);
}

/** Non-fatal problem codes (design §11). */
/** Every issue code, for runtime checks (spec 02 `parseFormIR`). */
export const ISSUE_CODES = [
  'CHECKSUM_MISMATCH',
  'MISSING_FILE',
  'UNLISTED_FILE',
  'DUPLICATE_NAME',
  'UNSAFE_NAME',
  'URN_MISMATCH',
  'UNRESOLVED_REFERENCE',
  'UNSAFE_XML',
  'INVALID_XML',
  'LIMIT_EXCEEDED',
  'INVALID_ENCODING',
  'XML_WARNING',
  'PATTERN_NOT_EVALUATED',
  'REPEATED_ELEMENT',
  'DUPLICATE_GLOBAL',
  // spec 02
  'UNRESOLVED_BINDING',
  'DUPLICATE_ID',
  // spec 03
  'RECORD_TEMPLATE_MISMATCH',
  'EXTERNAL_RESOURCE_BLOCKED',
  'UNKNOWN_FUNCTION',
  'ENGINE_WARNING',
  'XSL_MESSAGE',
  'OUTPUT_ESCAPING_IGNORED',
  'CONTENT_REMOVED',
  'CONTROL_NOT_MARKED',
  'UNSUPPORTED_CONTROL',
  'ATTACHMENT_UNREADABLE',
  'SECONDARY_DATA_UNAVAILABLE',
  'EXPRESSION_FAILED',
  'FORMAT_UNSUPPORTED',
  'LOCALE_UNSUPPORTED',
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export interface Issue {
  readonly code: IssueCode;
  /** English, for logs; the UI maps code → text. */
  readonly message: string;
  readonly file?: string;
  readonly path?: string;
  readonly offset?: number;
  readonly line?: number;
  readonly column?: number;
  readonly details?: Readonly<Record<string, string | number>>;
}
