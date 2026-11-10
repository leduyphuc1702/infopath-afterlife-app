// Spec 09 design §4: the messages between the page and the Worker. Core types only.
import type { ControlMark, ErrorCode, FormIR, Issue } from '@afterlife/core';

export type AppCode = 'FILE_TOO_LARGE' | 'TOO_MANY_FILES' | 'WORKER_TIMEOUT' | 'WORKER_FAILED';

export interface WireError {
  readonly code: ErrorCode | AppCode;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface InputFile {
  readonly name: string;
  /** Transferred, not copied. */
  readonly bytes: ArrayBuffer;
}

export type Req =
  | { readonly id: number; readonly type: 'warm' }
  | { readonly id: number; readonly type: 'open'; readonly files: readonly InputFile[] }
  | { readonly id: number; readonly type: 'openSample'; readonly sample: string }
  | {
      readonly id: number;
      readonly type: 'render';
      readonly templateId: string;
      readonly view: string;
      readonly recordId?: string;
      readonly now: string;
    };

/** A request without its id, as the page writes it. */
export type ReqBody = Req extends infer R ? (R extends Req ? Omit<R, 'id'> : never) : never;

export interface TemplateSummary {
  readonly templateId: string;
  readonly fileName: string;
  readonly ir: FormIR;
}

export type WireMatch =
  | { readonly kind: 'exact'; readonly templateId: string }
  | { readonly kind: 'otherVersion'; readonly templateId: string; readonly recordVersion: string }
  | {
      readonly kind: 'unmatched';
      readonly reason: 'noSolution' | 'noTemplate';
      readonly urn?: string;
    };

export interface RecordSummary {
  readonly recordId: string;
  readonly fileName: string;
  readonly match: WireMatch;
}

export interface FileFailure {
  readonly fileName: string;
  readonly error: WireError;
}

export interface SessionRes {
  readonly type: 'session';
  readonly templates: readonly TemplateSummary[];
  readonly records: readonly RecordSummary[];
  readonly failures: readonly FileFailure[];
}
export interface RenderedRes {
  readonly type: 'rendered';
  readonly html: string;
  readonly css: string;
  readonly issues: readonly Issue[];
  readonly marks: readonly ControlMark[];
}
export interface FailedRes {
  readonly type: 'failed';
  readonly error: WireError;
}
export interface ReadyRes {
  readonly type: 'ready';
}

export type ResBody = SessionRes | RenderedRes | FailedRes | ReadyRes;
export type Res = ResBody & { readonly id: number };
