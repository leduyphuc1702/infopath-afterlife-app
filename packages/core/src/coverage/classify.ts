// Spec 12 R1.1, R1.2, design §3: every FormIR element in exactly one class. Elements: each
// control, counted once per bound node and type across all views (D3); each view beyond the
// default; each rule action; each calculation; each validation; each data connection; the
// code-behind once; each ActiveX control (else each allowed control); each signed block and
// signature line. An element the table does not list is Manual and `unlisted` (D2).
import type { FormIR, IrConnection, IrValidation } from '../ir/types';
import type { Located } from '../unknown';
import {
  COVERAGE_TABLE,
  type CoverageClass,
  type CoverageEntry,
  type ElementKind,
  type RowRef,
} from './table';

export interface CoverageItem {
  readonly elementId: string;
  readonly kind: ElementKind;
  readonly subtype: string;
  readonly class: CoverageClass;
  readonly cites?: RowRef;
  readonly unlisted: boolean;
  readonly verify?: string;
  readonly source: Located;
}

export interface Coverage {
  readonly items: readonly CoverageItem[];
  readonly counts: Readonly<Record<CoverageClass, number>>;
}

/** Spec 03 §9.2: a blank check is `kind: blank`, or context `.` with `.=""` without whitespace. */
export const isBlankCheck = (v: IrValidation) =>
  v.kind === 'blank' ||
  (v.expressionContext === '.' && (v.expression ?? '').replace(/\s+/g, '') === '.=""');

/** An ActiveX control's `xctname` is its class id in braces; it is counted under `activeX`. */
const ACTIVEX_XCTNAME = /^\{+[0-9a-f-]{36}\}+$/i;

/** SharePoint list adapters are one subtype each for query and submit. */
const connectionSubtype = (c: IrConnection) =>
  /^share[pP]ointListAdapter/.test(c.adapterKind)
    ? `sharepointList:${c.isSubmit && !c.isQuery ? 'submit' : 'query'}`
    : c.adapterKind;

const index = new Map(COVERAGE_TABLE.map((e) => [`${e.kind}|${e.subtype}`, e]));
const lookup = (kind: ElementKind, subtype: string): CoverageEntry | undefined =>
  index.get(`${kind}|${subtype}`) ?? index.get(`${kind}|*`);

interface Element {
  readonly elementId: string;
  readonly kind: ElementKind;
  readonly subtype: string;
  readonly source: Located;
}

/** The elements of design §3, in a fixed order: by kind as listed, then document order. */
export function elementsOf(ir: FormIR): Element[] {
  const out: Element[] = [];
  const seen = new Set<string>();
  for (const v of ir.views)
    for (const c of v.controls) {
      const subtype = c.xctname ?? '';
      if (ACTIVEX_XCTNAME.test(subtype)) continue;
      const key = `${c.targetId ?? c.binding}|${subtype}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ elementId: c.id, kind: 'control', subtype, source: c.source });
    }
  for (const v of ir.views)
    if (!v.isDefault) out.push({ elementId: v.id, kind: 'view', subtype: '*', source: v.source });
  for (const r of ir.rules)
    for (const a of r.actions)
      out.push({ elementId: a.id, kind: 'action', subtype: a.kind, source: a.source });
  for (const c of ir.calculations)
    out.push({ elementId: c.id, kind: 'calculation', subtype: '*', source: c.source });
  for (const v of ir.validations)
    out.push({
      elementId: v.id,
      kind: 'validation',
      subtype: isBlankCheck(v) ? 'blank' : 'condition',
      source: v.source,
    });
  for (const c of ir.dataConnections)
    out.push({ elementId: c.id, kind: 'connection', subtype: connectionSubtype(c), source: c.source });
  if (ir.codeBehind.present)
    out.push({
      elementId: 'code-behind',
      kind: 'codeBehind',
      subtype: '*',
      // FormIR's code-behind has no location of its own: its first handler, else the manifest root.
      source: ir.codeBehind.handlers[0]?.source ?? ir.meta.source,
    });
  const ax = ir.activeX.controls.length > 0 ? ir.activeX.controls : ir.activeX.allowed;
  for (const a of ax) out.push({ elementId: a.id, kind: 'activeX', subtype: '*', source: a.source });
  for (const s of [...ir.signatures.blocks, ...ir.signatures.signatureLines])
    out.push({ elementId: s.id, kind: 'signature', subtype: '*', source: s.source });
  return out;
}

export function classify(ir: FormIR): Coverage {
  const counts: Record<CoverageClass, number> = { native: 0, emulated: 0, manual: 0, unsupported: 0 };
  const items = elementsOf(ir).map((e): CoverageItem => {
    const hit = lookup(e.kind, e.subtype);
    const item: CoverageItem = hit
      ? {
          ...e,
          class: hit.class,
          cites: hit.cites,
          unlisted: false,
          ...(hit.verify !== undefined && { verify: hit.verify }),
        }
      : { ...e, class: 'manual', unlisted: true };
    counts[item.class]++;
    return item;
  });
  return { items, counts };
}
