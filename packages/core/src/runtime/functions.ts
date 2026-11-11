// Spec 04 D6: the InfoPath functions the runtime offers. The bindings are spec 03's render table
// (src/render/functions.ts, values in src/xpath-fns/), so a value reads the same in a view and in
// a rule; only GetDOM differs: it returns the session's live secondary documents (D8).

import { functionTable, NS } from '../render/functions';
import type { FnImpl, FunctionTable } from '../render/engine/host';

export { NS };

export interface RuntimeFunctionInputs {
  /** ISO 8601 date-time with offset, sent with each command (R3.3). */
  readonly now: string;
}

const getDOM: FnImpl = (args, host) =>
  host.document(args[0]?.string() ?? '') ?? host.emptyDocument();

/** Spec 04 R3.1, R3.3: `xdUser:get-UserName()` is `""`; there is no user in the viewer. */
export function runtimeFunctions(inputs: RuntimeFunctionInputs): FunctionTable {
  const render = functionTable({ now: inputs.now, locale: 'en-US', userName: '' });
  const out = new Map<string, ReadonlyMap<string, FnImpl>>(render);
  out.set(NS.xdXDocument, new Map([...(render.get(NS.xdXDocument) ?? []), ['GetDOM', getDOM]]));
  return out;
}

/** `xdMath:Nz`, … : every function the runtime implements, as `prefix:local`, sorted. */
export function implementedFunctions(): readonly string[] {
  const prefix = new Map<string, string>(Object.entries(NS).map(([p, uri]) => [uri, p]));
  const out: string[] = [];
  for (const [uri, fns] of runtimeFunctions({ now: '2026-01-01T00:00:00Z' }))
    for (const local of fns.keys()) out.push(`${prefix.get(uri) ?? uri}:${local}`);
  return out.sort();
}
