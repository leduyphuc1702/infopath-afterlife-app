// buildFormIR: ParsedTemplate → FormIR (spec 02 design §3.2). Pure and synchronous.

import type { ParsedTemplate } from '../xsn/parse';
import { buildConnections } from './connections';
import { buildDataTree } from './data-tree';
import { buildDependencies } from './dependencies';
import { buildElements } from './elements';
import { IdRegistry } from './ids';
import { withInserts } from './inserts';
import { FORMIR_VERSION } from './json';
import { buildMeta } from './meta';
import type { FormIR } from './types';
import { labelFields } from './views/labels';
import { scanViews } from './views/scan';

export interface FormIROptions {
  /** Total bytes of view XSL the scan may read (R15); default 4 MiB. */
  readonly viewXmlBytes?: number;
}

export function buildFormIR(t: ParsedTemplate, options: FormIROptions = {}): FormIR {
  const ids = new IdRegistry();
  const meta = buildMeta(t.manifest); // stage 1
  const tree = buildDataTree(t, ids); // stage 2
  const elements = buildElements(t, ids); // stage 3
  const connections = buildConnections(t, ids); // stage 4
  const scan = scanViews({
    t,
    tree,
    ids,
    connections: connections.connections,
    ...(options.viewXmlBytes === undefined ? {} : { viewXmlBytes: options.viewXmlBytes }),
  }); // stage 5
  const fields = labelFields({
    fields: tree.fields,
    views: scan.views,
    controls: scan.controls,
    nodeOf: tree.nodeOf,
  }); // stage 6
  const deps = buildDependencies({
    t,
    tree,
    fields,
    elements,
    connections: connections.connections,
    connectionPending: connections.pending,
    controls: scan.controls,
    ctrlContexts: scan.ctrlContexts,
  }); // stage 7
  return {
    irVersion: FORMIR_VERSION,
    meta: connections.publishEndpoint
      ? { ...meta, publishEndpoint: connections.publishEndpoint }
      : meta,
    fields: deps.fields,
    groups: withInserts(t, deps.groups),
    views: scan.views,
    rules: deps.elements.rules,
    calculations: deps.elements.calculations,
    validations: deps.elements.validations,
    dataConnections: deps.connections,
    codeBehind: deps.elements.codeBehind,
    signatures: deps.elements.signatures,
    activeX: { controls: scan.activeX, allowed: elements.allowed },
    dependencies: { references: deps.references },
    unknowns: t.unknowns,
    issues: [...t.issues, ...scan.issues, ...deps.issues, ...ids.issues],
  };
}
