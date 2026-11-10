// Typed errors and issues (design §11). Fatal problems throw AfterlifeError; everything else is
// an Issue in the result. `message` is English for logs; the UI maps `code` to user text.

import type { Limits } from './limits';

/** Detail fields per fatal error code. */
export interface ErrorDetailsByCode {
  UNSUPPORTED_COMPRESSION: { method: 'LZX' | 'Quantum' | number; folder: number };
  UNSUPPORTED_CAB: { feature: 'prevCabinet' | 'nextCabinet' };
  /** `otherOffset`: the start of the range an overlapping folder runs into (R3.7). */
  CORRUPT_CAB: { offset: number; reason: string; otherOffset?: number };
  /** `line` and `column`: where an `xmlDepth` overrun was found. */
  LIMIT_EXCEEDED: {
    limit: keyof Limits;
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
  INTERNAL: { path: string };
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
  INTERNAL: (d) => `Internal error: modelled node not consumed at ${d.path}`,
};

function errorMessage<C extends ErrorCode>(code: C, details: ErrorDetailsByCode[C]): string {
  return (MESSAGES[code] as (d: ErrorDetailsByCode[C]) => string)(details);
}

/** Non-fatal problem codes (design §11). */
export type IssueCode =
  | 'CHECKSUM_MISMATCH'
  | 'MISSING_FILE'
  | 'UNLISTED_FILE'
  | 'DUPLICATE_NAME'
  | 'UNSAFE_NAME'
  | 'URN_MISMATCH'
  | 'UNRESOLVED_REFERENCE'
  | 'UNSAFE_XML'
  | 'INVALID_XML'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_ENCODING'
  | 'XML_WARNING'
  | 'PATTERN_NOT_EVALUATED';

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
