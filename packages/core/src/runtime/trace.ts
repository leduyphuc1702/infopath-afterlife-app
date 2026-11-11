// Spec 04 R9.1, design D25: what the Rule Trace shows.

export interface TraceEntry {
  readonly seq: number;
  /** The command's `now`. */
  readonly at: string;
  /** `undo` and `redo` are added by the page (spec 16 N1); core never writes them. */
  readonly kind:
    'rule' | 'calc' | 'validation' | 'skipped' | 'loop' | 'notEvaluated' | 'undo' | 'redo';
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
  /** Spec 16 K2: the caption of the button whose press ran this rule. */
  readonly button?: string | undefined;
  /** Spec 16 K13: a calculation done while the record opened, from its stored value. */
  readonly opened?: true | undefined;
}

export const TRACE_CAP = 500;
