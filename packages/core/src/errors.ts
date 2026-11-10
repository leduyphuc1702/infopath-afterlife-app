// Typed errors (design §11). Task 3 adds Issue, IssueCode and per-code detail types; task 2
// needs only the class, for CORRUPT_CAB from the inflater.

export type ErrorCode =
  | 'UNSUPPORTED_COMPRESSION'
  | 'UNSUPPORTED_CAB'
  | 'CORRUPT_CAB'
  | 'LIMIT_EXCEEDED'
  | 'MISSING_MANIFEST'
  | 'UNSAFE_XML'
  | 'INVALID_XML'
  | 'INTERNAL';

export type ErrorDetails = Readonly<Record<string, string | number>>;

export class AfterlifeError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails;

  constructor(code: ErrorCode, details: ErrorDetails, message?: string) {
    super(message ?? `${code}: ${JSON.stringify(details)}`);
    this.name = 'AfterlifeError';
    this.code = code;
    this.details = details;
  }
}
