// Stage 4: data connections (spec 02 R8.1–R8.4, design §5 notes, §8). Every adapter becomes one
// connection. Any secret in an attribute value (a password key, a URL userinfo password) is
// redacted wherever it sits (adapter, child, connection extension), so it reaches no part of FormIR.

import type { Located } from '../unknown';
import type { Adapter, ConnectionExtension } from '../xsf/types';
import type { ParsedTemplate } from '../xsn/parse';
import { localKind, type PendingExpr } from './elements';
import { classifyEndpoint, redactSecrets } from './endpoints';
import { loc, manifestId, type IdRegistry } from './ids';
import type { Attrs, Endpoint, IrConnection } from './types';

/** Attributes holding an endpoint, per element key (design §8). */
const ENDPOINT_ATTRS: Readonly<Record<string, readonly string[]>> = {
  'xsf:adoAdapter': ['connectionString'],
  'xsf:webServiceAdapter': ['wsdlUrl'],
  'xsf:operation': ['serviceUrl'],
  'xsf:xmlFileAdapter': ['fileUrl'],
  'xsf:sharepointListAdapter': ['siteUrl'],
  'xsf:sharepointListAdapterRW': ['siteURL'],
  'xsf:davAdapter/folderURL': ['value'],
  'xsf2:connectoid': ['source'],
};
/** The endpoint's `attribute` name when it differs from the XML attribute. */
const ENDPOINT_NAME: Readonly<Record<string, string>> = { 'xsf:davAdapter/folderURL': 'folderURL' };

const SUBMIT_VALUE = new Set([
  'xsf:emailAdapter/to',
  'xsf:emailAdapter/cc',
  'xsf:emailAdapter/bcc',
  'xsf:emailAdapter/subject',
  'xsf:emailAdapter/attachmentFileName',
  'xsf:davAdapter/fileName',
]);

export interface ConnectionParts {
  readonly connections: IrConnection[];
  readonly publishEndpoint?: Endpoint;
  readonly pending: PendingExpr[];
}

interface Element {
  readonly key: string;
  readonly path: string;
  readonly attrs: Readonly<Record<string, string | undefined>>;
}

function at(e: Located, attribute?: string): Located {
  const l = loc(e);
  return attribute === undefined ? l : { ...l, path: `${l.path}/@${attribute}` };
}

export function buildConnections(t: ParsedTemplate, ids: IdRegistry): ConnectionParts {
  const m = t.manifest;
  const files = new Set(t.files.map((f) => f.name.toLowerCase()));
  const pending: PendingExpr[] = [];

  const sources: { a: Adapter; dataSource?: string }[] = [
    ...(m.mainQuery ? [{ a: m.mainQuery, dataSource: 'main' }] : []),
    ...m.dataObjects.flatMap((d) =>
      d.query
        ? [{ a: d.query, ...(d.attrs.name === undefined ? {} : { dataSource: d.attrs.name }) }]
        : [],
    ),
    ...(m.submit?.adapters ?? []).map((a) => ({ a })),
    ...m.dataAdapters.map((a) => ({ a })),
  ].sort((x, y) => x.a.line - y.a.line || x.a.column - y.a.column);

  const extensionsOf = (a: Adapter): ConnectionExtension[] =>
    m.connectionExtensions.filter((e) => e.adapterPath === a.path);

  const connections = sources.map(({ a, dataSource }): IrConnection => {
    const id = ids.claim(manifestId('conn', a.path), a);
    let redacted = false;
    const clean = (attrs: Element['attrs']): Attrs => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined) continue;
        const r = redactSecrets(v);
        redacted ||= r.redacted;
        out[k] = r.value;
      }
      return out;
    };
    const endpoints: Endpoint[] = [];
    const collect = (e: Element & Located) => {
      for (const attr of ENDPOINT_ATTRS[e.key] ?? []) {
        const v = e.attrs[attr];
        if (v === undefined || v.trim() === '') continue;
        endpoints.push(classifyEndpoint(ENDPOINT_NAME[e.key] ?? attr, v, at(e, attr), files));
      }
    };

    const attrs = clean(a.attrs);
    collect(a);
    const children = a.children.map((c) => {
      collect(c);
      const cattrs = c.attrs as Element['attrs'];
      if (SUBMIT_VALUE.has(c.key) && cattrs.valueType === 'expression') {
        const text = cattrs.value;
        if (text !== undefined && text.trim() !== '') {
          pending.push({ elementId: id, role: 'submitValue', text, context: { kind: 'mainRoot' } });
        }
      }
      return { kind: localKind(c.key), attrs: clean(cattrs), source: loc(c) };
    });
    for (const ext of extensionsOf(a)) {
      clean(ext.attrs);
      if (ext.connectoid) {
        clean(ext.connectoid.attrs);
        collect(ext.connectoid);
      }
    }

    return {
      id,
      ...(attrs.name === undefined ? {} : { name: attrs.name }),
      adapterKind: localKind(a.key),
      ...(dataSource === undefined ? {} : { dataSource }),
      isQuery: a.role === 'query' || attrs.queryAllowed === 'yes',
      isSubmit: a.role === 'submit' || attrs.submitAllowed === 'yes',
      attrs,
      children,
      endpoints,
      credentialRedacted: redacted || a.containsCredential,
      lineage: { fieldIds: [], usedBy: [] },
      unresolvedRefs: [],
      source: loc(a),
    };
  });

  const dc = m.documentClass;
  const publishUrl = dc.attrs.publishUrl;
  return {
    connections,
    ...(publishUrl === undefined || publishUrl.trim() === ''
      ? {}
      : {
          publishEndpoint: classifyEndpoint('publishUrl', publishUrl, at(dc, 'publishUrl'), files),
        }),
    pending,
  };
}
