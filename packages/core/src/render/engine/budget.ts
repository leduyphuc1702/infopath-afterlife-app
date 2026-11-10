// The work one render does, and its limits (spec 03 design §6, R3.3). Every hook charges the
// budget of the processor it runs in; there is one budget per render. A charge over a limit
// stores its LIMIT_EXCEEDED in the abort slot, then throws it: xsltjs may wrap or swallow what a
// hook throws, and the adapter rethrows the stored error whatever arrives (design §5.3).

import { AfterlifeError } from '../../errors';
import { DEFAULT_RENDER_LIMITS, type RenderLimits } from '../../limits';

/** Characters of a string result charged as one evaluation step (design §6). */
export const STRING_CHARS_PER_STEP = 16;
/** Output bytes charged per result node, besides its characters (design §6). */
export const BYTES_PER_NODE = 64;

export class Budget {
  /** Instructions, XPath location steps and string results (design §6). */
  steps = 0;
  /** Characters added to any result tree, plus 64 per node. */
  output = 0;
  /** Nested template calls, built-in rule calls and `xdMath:Eval` calls. */
  depth = 0;
  /** The deepest `depth` reached. */
  maxDepth = 0;
  /** The first limit overrun of this render. */
  abort: AfterlifeError<'LIMIT_EXCEEDED'> | undefined;

  constructor(readonly limits: RenderLimits = DEFAULT_RENDER_LIMITS) {}

  /** One XSLT instruction. */
  step(): void {
    if (++this.steps > this.limits.evaluationSteps) this.fail('evaluationSteps', this.steps);
  }

  /** One XPath location step that returned `nodes` nodes. */
  chargeStep(nodes: number): void {
    this.steps += 1 + nodes;
    if (this.steps > this.limits.evaluationSteps) this.fail('evaluationSteps', this.steps);
  }

  /** One string built by a string function or `formatString`. */
  chargeString(length: number): void {
    this.steps += Math.ceil(length / STRING_CHARS_PER_STEP);
    if (this.steps > this.limits.evaluationSteps) this.fail('evaluationSteps', this.steps);
  }

  /** `chars` characters and `nodes` nodes added to a result tree. */
  chargeOutput(chars: number, nodes = 0): void {
    this.output += chars + nodes * BYTES_PER_NODE;
    if (this.output > this.limits.outputBytes) this.fail('outputBytes', this.output);
  }

  /** One level deeper; the caller decrements `depth` when the level ends (in a `finally`). */
  enter(): void {
    if (++this.depth > this.limits.templateDepth) {
      const observed = this.depth--;
      this.fail('templateDepth', observed);
    }
    if (this.depth > this.maxDepth) this.maxDepth = this.depth;
  }

  /** A stack overflow, at the current depth (design §5.3, Errors). */
  stackOverflow(): AfterlifeError<'LIMIT_EXCEEDED'> {
    return (this.abort ??= new AfterlifeError('LIMIT_EXCEEDED', {
      limit: 'templateDepth',
      max: this.limits.templateDepth,
      observed: this.maxDepth,
    }));
  }

  private fail(limit: keyof RenderLimits, observed: number): never {
    throw (this.abort ??= new AfterlifeError('LIMIT_EXCEEDED', {
      limit,
      max: this.limits[limit],
      observed,
    }));
  }
}
