// buildFormIR: ParsedTemplate → FormIR (spec 02 design §3.2). Pure and synchronous. Stages 4–7
// (connections, view scan, labels, references) are added by tasks 5–9.

import type { ParsedTemplate } from '../xsn/parse';
import { buildDataTree } from './data-tree';
import { buildElements } from './elements';
import { IdRegistry } from './ids';
import { FORMIR_VERSION } from './json';
import { buildMeta } from './meta';
import type { FormIR } from './types';

export interface FormIROptions {
  /** Total bytes of view XSL the scan may read (R15); default 4 MiB. */
  readonly viewXmlBytes?: number;
}

export function buildFormIR(t: ParsedTemplate, options: FormIROptions = {}): FormIR {
  void options; // read by the view scan (task 7)
  const ids = new IdRegistry();
  const meta = buildMeta(t.manifest); // stage 1
  const tree = buildDataTree(t, ids); // stage 2
  const elements = buildElements(t, ids); // stage 3
  return {
    irVersion: FORMIR_VERSION,
    meta,
    fields: tree.fields,
    groups: tree.groups,
    views: [],
    rules: elements.rules,
    calculations: elements.calculations,
    validations: elements.validations,
    dataConnections: [],
    codeBehind: elements.codeBehind,
    signatures: elements.signatures,
    activeX: { controls: [], allowed: elements.allowed },
    dependencies: { references: [] },
    unknowns: t.unknowns,
    issues: [...t.issues, ...ids.issues],
  };
}
