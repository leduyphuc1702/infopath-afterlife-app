// The InfoPath extension functions a render offers (spec 03 design §7.1). Bindings only: the
// value logic is in src/xpath-fns/, and the engine is reached through FnArg, never directly.
// Task 2 implements xdFormatting:formatString; task 6 adds the other R4.1 functions.

import type { FnImpl, FunctionTable } from './engine/host';
import { formatString } from '../xpath-fns/format';

export const NS = {
  xdFormatting: 'http://schemas.microsoft.com/office/infopath/2003/xslt/formatting',
} as const;

/** What the functions of one render depend on, besides their arguments. */
export interface FunctionInputs {
  readonly now: string;
  readonly locale: string;
  readonly userName: string;
}

const str = (args: Parameters<FnImpl>[0], i: number) => args[i]?.string() ?? '';

/** Task 6 reads `inputs` (Today, Now, get-UserName); formatString is en-US only until task 7. */
export function functionTable(inputs: FunctionInputs): FunctionTable {
  void inputs;
  return new Map([
    [
      NS.xdFormatting,
      new Map<string, FnImpl>([
        ['formatString', (args) => formatString(str(args, 0), str(args, 1), str(args, 2))],
      ]),
    ],
  ]);
}
