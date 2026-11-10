// Spec 12 R2.1, design §4: the causes of one form, each with its evidence in the template or in
// a record. A cause is listed only when there is evidence; catalogue order.
import type { Endpoint, FormIR } from '../ir/types';
import type { Located } from '../unknown';
import { CAUSE_IDS, CAUSES, type CauseId, type CauseInfo } from './catalogue';
import type { RecordEvidence } from './record';

export interface Evidence {
  readonly located: Located;
  /** What the evidence shows, in words: "SQL connection to sql-legacy01". */
  readonly what: string;
}

export interface Cause extends CauseInfo {
  readonly evidence: readonly Evidence[];
  readonly from: 'template' | 'record';
}

/** A code file is evidence as a whole. */
const CODE_FILE = '/';

/** `records` are the open records matched to this template. */
export function causesOf(ir: FormIR, records: readonly RecordEvidence[] = []): Cause[] {
  const found = new Map<CauseId, { evidence: Evidence[]; from: 'template' | 'record' }>();
  const add = (id: CauseId, e: Evidence, from: 'template' | 'record' = 'template') => {
    const c = found.get(id) ?? { evidence: [], from };
    c.evidence.push(e);
    found.set(id, c);
  };
  const m = ir.meta;

  if (m.browserCompatible)
    add('forms-services-spo', {
      located: m.source,
      what: 'browser-compatible template: runtimeCompatibility includes "server"',
    });
  add('infopath-client', {
    located: m.source,
    what: `InfoPath ${m.generation === 'unknown' ? '' : `${m.generation} `}form template`,
  });
  for (const r of records)
    if (r.stylesheet)
      add(
        'browser-xslt',
        { located: r.stylesheet, what: `${r.fileName} names a stylesheet for the browser` },
        'record',
      );

  const internal = (e: Endpoint) => e.liveness === 'internal';
  for (const c of ir.dataConnections) {
    const name = c.name ?? c.dataSource ?? c.adapterKind;
    if (c.adapterKind === 'adoAdapter') {
      const host = c.endpoints.find((e) => e.host)?.host;
      add('internal-sql', {
        located: c.source,
        what: `database connection ${name}${host ? ` to ${host}` : ''}`,
      });
      continue;
    }
    for (const e of c.endpoints.filter(internal))
      add('internal-service', {
        located: e.source,
        what: `${name} (${c.adapterKind}) calls internal host ${e.host ?? e.value}`,
      });
  }
  for (const a of ir.activeX.controls)
    if (a.server && internal(a.server))
      add('internal-service', {
        located: a.server.source,
        what: `ActiveX control's server is internal host ${a.server.host ?? a.server.value}`,
      });

  const cb = ir.codeBehind;
  if (cb.present) {
    const langs = cb.languages.join(', ') || 'unknown language';
    add('code-behind', { located: m.source, what: `code-behind in ${langs}` });
    for (const f of cb.files)
      add('code-behind', {
        located: { file: f, path: CODE_FILE, line: 1, column: 1 },
        what: `code file ${f}`,
      });
    for (const h of cb.handlers)
      add('code-behind', { located: h.source, what: `event ${h.handler} on ${h.match}` });
  }

  const ax: readonly { readonly id: string; readonly clsid?: string; readonly source: Located }[] =
    ir.activeX.controls.length > 0
      ? ir.activeX.controls.map((a) => ({
          id: a.id,
          source: a.source,
          ...(a.classid !== undefined && { clsid: a.classid }),
        }))
      : ir.activeX.allowed;
  for (const a of ax)
    add('activex', { located: a.source, what: `ActiveX control ${a.clsid ?? a.id}` });

  for (const b of ir.signatures.blocks)
    add('signatures', { located: b.source, what: `signed data block ${b.name ?? b.id}` });
  for (const s of ir.signatures.signatureLines)
    add('signatures', { located: s.source, what: 'signature line' });

  return CAUSE_IDS.flatMap((id) => {
    const f = found.get(id);
    return f ? [{ ...CAUSES[id], evidence: f.evidence, from: f.from }] : [];
  });
}
