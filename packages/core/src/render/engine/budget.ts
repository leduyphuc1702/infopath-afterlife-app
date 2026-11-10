// The work one render does (spec 03 design §6). Every hook charges the budget of the processor
// it runs in; there is one budget per render. Task 5 adds the limits; until then it only counts.

/** Characters of a string result charged as one evaluation step (design §6). */
export const STRING_CHARS_PER_STEP = 16;

export class Budget {
  /** Instructions, XPath location steps and string results (design §6). */
  steps = 0;

  /** One XPath location step that returned `nodes` nodes. */
  chargeStep(nodes: number): void {
    this.steps += 1 + nodes;
  }

  /** One string built by a string function or `formatString`. */
  chargeString(length: number): void {
    this.steps += Math.ceil(length / STRING_CHARS_PER_STEP);
  }
}
