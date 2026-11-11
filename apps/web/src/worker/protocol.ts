// Spec 09 design §4: the messages between the page and the Worker. Core types only.
import type {
  ControlMark,
  Dossier,
  RowMark,
  ErrorCode,
  FormIR,
  Issue,
  TraceEntry,
  TriageResult,
} from '@afterlife/core';

export type AppCode =
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_FILES'
  | 'WORKER_TIMEOUT'
  | 'WORKER_FAILED'
  /** Spec 04 R1.4: a fill command named no field it can change. */
  | 'FILL_PATH'
  /** Spec 04 R1.5: no fill session, or a record Fill does not take. */
  | 'FILL_STATE';

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
  /** Spec 09 R12.1: the records of one template, as a workbook or a zip of CSVs. */
  | {
      readonly id: number;
      readonly type: 'exportRecords';
      readonly templateId: string;
      readonly format: 'xlsx' | 'csv';
    }
  /** Spec 15 R3: one form's dossier, or a `.zip` of the Markdown of several. */
  | { readonly id: number; readonly type: 'documentation'; readonly templateId: string }
  | {
      readonly id: number;
      readonly type: 'documentationZip';
      readonly templateIds: readonly string[];
    }
  /** Spec 04 R1.1: a fill session for the open template's empty form or one exact record. */
  | {
      readonly id: number;
      readonly type: 'fillOpen';
      readonly templateId: string;
      readonly recordId?: string;
      readonly view: string;
      readonly now: string;
    }
  /** Spec 04 R1.3: one command to the fill session; the answer renders `view`. */
  | {
      readonly id: number;
      readonly type: 'fill';
      readonly command: FillCommand;
      readonly view: string;
      readonly now: string;
    }
  /** Spec 04 R8.1: the filled record's bytes. */
  | { readonly id: number; readonly type: 'fillDownload' }
  | { readonly id: number; readonly type: 'fillClose' }
  | {
      readonly id: number;
      readonly type: 'render';
      readonly templateId: string;
      readonly view: string;
      readonly recordId?: string;
      readonly now: string;
    };

/**
 * Spec 04 task 12: where focus was in the paper, kept with an undo step and given back on undo
 * (the page's `FocusState` without typed text).
 */
export interface PaperFocus {
  readonly ctrl: string;
  readonly path: string | undefined;
  readonly text?: string;
  readonly caret?: number;
  /** A row menu button or insert placeholder, by its item's node and kind. */
  readonly structure?: { readonly node: string; readonly kind: string };
  /** A button in the view, by its `xd:CtrlId`, in its row when it has one. */
  readonly button?: { readonly ctrl: string; readonly row?: string };
}

export type FillCommand = FillAction & {
  /** Spec 04 task 12: focus in the paper when the command was given. */
  readonly focus?: PaperFocus;
};

export type FillAction =
  | { readonly kind: 'edit'; readonly path: string; readonly value: string }
  | { readonly kind: 'press'; readonly ctrlId: string; readonly path?: string }
  /** Render again with no change, e.g. for another view. */
  | { readonly kind: 'render' }
  /** Spec 04 task 9: "Insert item" (`in`, its context node) or the row menu (`row`, `where`). */
  | {
      readonly kind: 'insertRow';
      readonly groupId: string;
      readonly at:
        { readonly in: string } | { readonly row: string; readonly where: 'before' | 'after' };
    }
  | { readonly kind: 'removeRow'; readonly path: string }
  | { readonly kind: 'insertOptional'; readonly groupId: string; readonly in: string }
  | { readonly kind: 'removeOptional'; readonly path: string }
  /** Spec 04 task 12 (R10.1): whole commands, as snapshots. */
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' };

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
  /** Spec 09 R12.8: entries of this request's `.zip` files that are not opened, as `a.zip › b`. */
  readonly ignored: readonly string[];
  /** Spec 12: every open template triaged, with the open records (design §6). */
  readonly triage: TriageResult;
}
export interface RenderedRes {
  readonly type: 'rendered';
  readonly html: string;
  readonly css: string;
  readonly issues: readonly Issue[];
  readonly marks: readonly ControlMark[];
  /** Spec 04 task 8: core's row marks, as core gives them (absent when none). */
  readonly rows?: readonly RowMark[];
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

/** Spec 09 R12.4: the finished export; `bytes` is transferred. */
export interface ExportedRes {
  readonly type: 'exported';
  readonly fileName: string;
  readonly bytes: ArrayBuffer;
  readonly records: number;
  /** Attachments and pictures found (in the `.zip` export, the files themselves). */
  readonly files: number;
  readonly unread: number;
}

/** Spec 15: one form's dossier, as data for the screen and as Markdown. */
export interface DocumentationRes {
  readonly type: 'documentation';
  readonly dossier: Dossier;
  readonly markdown: string;
  readonly fileName: string;
}

/** Spec 04: a render of the fill session's record, with what the page needs to edit it. */
export interface FilledRes extends Omit<RenderedRes, 'type'> {
  readonly type: 'filled';
  /** Mark path → the node's text as stored (the paper may show it formatted). */
  readonly values: Readonly<Record<string, string>>;
  /** Mark paths of calculated fields: shown, never edited (R6.2). */
  readonly calculated: readonly string[];
  /** R5.1, in record order. */
  readonly invalid: readonly {
    readonly path: string;
    readonly short: string;
    readonly message: string;
  }[];
  /** This command's trace entries (R9.1). */
  readonly trace: readonly TraceEntry[];
  readonly dialogs: readonly string[];
  readonly notices: readonly string[];
  /** A switch view action's view name. */
  readonly view?: string;
  /** A change since the session opened that was not downloaded (R6.4). */
  readonly dirty: boolean;
  /** Spec 04 task 12: how many steps can be undone and redone. */
  readonly undo: number;
  readonly redo: number;
  /** Spec 04 task 12: after an undo or redo, where focus was then. */
  readonly restore?: PaperFocus;
  /** Spec 04 task 9: the item to focus after an insert or remove (its `data-afl-node`). */
  readonly focus?: string;
  /** Spec 04 task 9: a name for each group with rows on the page, for row menus ("Expenses"). */
  readonly groups: Readonly<Record<string, string>>;
  /** Opening only: calculated fields the record stored empty and the runtime worked out. */
  readonly workedOut: number;
  /** Spec 16 K13: stored values the form's formulas disagreed with, corrected on open. */
  readonly corrected: number;
  /** R2.4: command in to render out, in the Worker. */
  readonly ms: number;
}

/** Spec 04 R8.1: the filled record; `bytes` is transferred. */
export interface FilledXmlRes {
  readonly type: 'filledXml';
  readonly fileName: string;
  readonly bytes: ArrayBuffer;
  readonly invalid: number;
}

export type ResBody =
  | SessionRes
  | RenderedRes
  | FailedRes
  | ReadyRes
  | CsvRes
  | ExportedRes
  | FilledRes
  | FilledXmlRes
  | DocumentationRes;

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
