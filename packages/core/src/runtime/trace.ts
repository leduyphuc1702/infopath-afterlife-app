// Spec 04 R9.1, design D25: what the Rule Trace shows.

export interface TraceEntry {
  readonly seq: number;
  /** The command's `now`. */
  readonly at: string;
  readonly kind: 'rule' | 'calc' | 'validation' | 'skipped' | 'loop' | 'notEvaluated';
  /** The path of the field whose change started this, when there is one. */
  readonly trigger?: string | undefined;
  /** Rule caption, or the calculated field's path, or the validation's message. */
  readonly caption: string;
  readonly condition?: boolean | undefined;
  readonly changes: readonly {
    readonly path: string;
    readonly before: string;
    readonly after: string;
  }[];
  readonly note?: string | undefined;
}

export const TRACE_CAP = 500;
