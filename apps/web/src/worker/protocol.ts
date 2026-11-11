// Spec 09 design §4: the messages between the page and the Worker. Core types only.
import type { ControlMark, ErrorCode, FormIR, Issue, TriageResult } from '@afterlife/core';

export type AppCode = 'FILE_TOO_LARGE' | 'TOO_MANY_FILES' | 'WORKER_TIMEOUT' | 'WORKER_FAILED';

export interface WireError {
  readonly code: ErrorCode | AppCode;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface InputFile {
  readonly name: string;
  /** Transferred, not copied. */
  readonly bytes: ArrayBuffer;
  /** A bundled sample's id: its Triage row uses the sample's display name (spec 12). */
  readonly sample?: string;
}

export type Req =
  | { readonly id: number; readonly type: 'warm' }
  | { readonly id: number; readonly type: 'open'; readonly files: readonly InputFile[] }
  | { readonly id: number; readonly type: 'openSample'; readonly sample: string }
  /** Spec 12 R4.5: every bundled sample, for "Triage all samples". */
  | { readonly id: number; readonly type: 'openAllSamples' }
  /** Spec 12 R5.1: the session's Triage as CSV. */
  | { readonly id: number; readonly type: 'csv' }
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

/** Spec 13 B3: a file of this request whose bytes were already open, so it was not added. */
export interface Duplicate {
  readonly fileName: string;
  /** The open template it is; absent for a record or a file that failed. */
  readonly templateId?: string;
}

export interface SessionRes {
  readonly type: 'session';
  readonly templates: readonly TemplateSummary[];
  readonly records: readonly RecordSummary[];
  readonly failures: readonly FileFailure[];
  /** This request's files that were already open (B3); empty on other answers. */
  readonly duplicates: readonly Duplicate[];
  /** Spec 12: every open template triaged, with the open records (design §6). */
  readonly triage: TriageResult;
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

export interface CsvRes {
  readonly type: 'csv';
  readonly text: string;
}

export type ResBody = SessionRes | RenderedRes | FailedRes | ReadyRes | CsvRes;

/**
 * Spec 12 R4.4: sent with an `open` or `openSample` request's id before its answer, once per
 * file, as the Worker starts reading it. Not an answer: the request stays open.
 */
export interface ProgressMsg {
  readonly type: 'progress';
  /** 1-based: "Reading 12 of 40". */
  readonly index: number;
  readonly total: number;
  readonly fileName: string;
}
export type Progress = (p: ProgressMsg) => void;

export type Res = (ResBody | ProgressMsg) & { readonly id: number };
