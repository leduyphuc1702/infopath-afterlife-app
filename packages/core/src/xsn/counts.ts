// countTemplate (design §9.4, R16.1): the README columns, computed from the parser output. Spec 12
// (Triage) uses the same function, so the oracle and the product share one definition.
// Repeating/optional comes from the main field tree, not from xsf:editWith (form 44, R16.1).

import type { FieldNode } from '../xsd/types';
import type { ParsedTemplate } from './parse';

export interface TemplateCounts {
  readonly views: number;
  readonly fields: number;
  readonly rules: number;
  readonly calcs: number;
  readonly checks: number;
  readonly repeatingOrOptional: number;
}

export function countTemplate(t: ParsedTemplate): TemplateCounts {
  const elements: FieldNode[] = [];
  const visit = (n: FieldNode) => {
    if (n.nodeType !== 'element') return;
    elements.push(n);
    n.children.forEach(visit);
  };
  if (t.schemas.main) visit(t.schemas.main.root);
  return {
    views: t.manifest.views.length,
    fields: elements.length,
    rules: t.manifest.ruleSets.reduce((n, s) => n + s.rules.length, 0),
    calcs: t.manifest.calculations.length,
    checks: t.manifest.validations.length,
    repeatingOrOptional: elements.filter((n) => n.repeating || n.optional).length,
  };
}
