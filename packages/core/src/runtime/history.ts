// Spec 04 R10.1, design D26: undo and redo of whole commands, as snapshots, at most 100.

export const UNDO_CAP = 100;

/**
 * Two stacks of states. `record(before)` is called after each command that changed something,
 * with the state from before it; it clears redo. `undo(now)` and `redo(now)` take the state the
 * page shows now and give the one to put back.
 */
export class History<S> {
  private readonly past: S[] = [];
  private readonly future: S[] = [];

  constructor(private readonly cap = UNDO_CAP) {}

  record(before: S): void {
    this.past.push(before);
    if (this.past.length > this.cap) this.past.splice(0, this.past.length - this.cap);
    this.future.length = 0;
  }

  undo(now: S): S | undefined {
    const s = this.past.pop();
    if (s !== undefined) this.future.push(now);
    return s;
  }

  redo(now: S): S | undefined {
    const s = this.future.pop();
    if (s !== undefined) this.past.push(now);
    return s;
  }

  get undoable(): number {
    return this.past.length;
  }

  get redoable(): number {
    return this.future.length;
  }
}
