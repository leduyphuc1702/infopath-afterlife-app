// Stage 3: rules, calculations, validations, code-behind, signatures and allowed ActiveX controls
// (spec 02 R6, R7, R9, R4.5). Expressions are copied as written (R1.2). The `…Id` properties that
// name fields (targetId, matchId, dataId) are filled by stage 7 from the PendingExpr records.

import type { Manifest } from '../xsf/types';
import type { ParsedTemplate } from '../xsn/parse';
import { loc, manifestId, type IdRegistry } from './ids';
import type {
  ActiveX,
  CodeBehind,
  DepRole,
  IrAction,
  IrCalculation,
  IrRule,
  IrValidation,
  Signatures,
  Trigger,
} from './types';

/** The node a relative path in an expression starts from (design §7.2). */
export type ExprContext =
  | { readonly kind: 'document' }
  | { readonly kind: 'mainRoot' }
  /** The node of the absolute `path`, then `then` applied as a relative path. */
  | { readonly kind: 'node'; readonly path: string; readonly then?: string }
  /** Each `fieldChange` trigger of the rule set, else the main root. */
  | { readonly kind: 'ruleSet'; readonly name: string };

/** One expression waiting for stage 7 (references). */
export interface PendingExpr {
  readonly elementId: string;
  readonly role: DepRole;
  readonly text: string;
  readonly context: ExprContext;
}

export interface ElementParts {
  readonly rules: IrRule[];
  readonly calculations: IrCalculation[];
  readonly validations: IrValidation[];
  readonly codeBehind: CodeBehind;
  readonly signatures: Signatures;
  readonly allowed: ActiveX['allowed'][number][];
  readonly pending: PendingExpr[];
}

const DOCUMENT: ExprContext = { kind: 'document' };

/** `xsf:assignmentAction` → `assignmentAction`; `xsf:rule/submitAction` → `submitAction`. */
export function localKind(key: string): string {
  return key.slice(Math.max(key.lastIndexOf('/'), key.lastIndexOf(':')) + 1);
}

function opt<K extends string, V>(key: K, v: V | undefined): { [P in K]?: V } {
  return (v === undefined ? {} : { [key]: v }) as { [P in K]?: V };
}

function triggersOf(m: Manifest, ruleSet: string): Trigger[] {
  return m.bindings
    .filter((b) => b.attrs.ruleSet === ruleSet)
    .map((b): Trigger => {
      const source = loc(b);
      const tr = b.trigger;
      switch (tr.kind) {
        case 'fieldChange':
          return { kind: 'fieldChange', match: tr.handler.attrs.match ?? '', source };
        case 'button':
          return {
            kind: 'button',
            ...opt('view', tr.view),
            ...opt('button', tr.button.attrs.name),
            source,
          };
        default:
          return { kind: tr.kind, source };
      }
    });
}

export function buildElements(t: ParsedTemplate, ids: IdRegistry): ElementParts {
  const m = t.manifest;
  const pending: PendingExpr[] = [];
  const add = (
    elementId: string,
    role: DepRole,
    text: string | undefined,
    context: ExprContext,
  ) => {
    if (text !== undefined && text.trim() !== '') pending.push({ elementId, role, text, context });
  };

  // R6: rules, actions, triggers.
  const rules: IrRule[] = [];
  for (const rs of m.ruleSets) {
    const ruleSet = rs.attrs.name ?? '';
    const context: ExprContext = { kind: 'ruleSet', name: ruleSet };
    const triggers = triggersOf(m, ruleSet);
    for (const r of rs.rules) {
      const id = ids.claim(manifestId('rule', r.path), r);
      add(id, 'condition', r.attrs.condition, context);
      for (const tr of triggers)
        if (tr.kind === 'fieldChange') add(id, 'trigger', tr.match, DOCUMENT);
      const actions = r.actions.map((a): IrAction => {
        const aid = ids.claim(manifestId('action', a.path), a);
        const attrs = { ...a.attrs } as Record<string, string>;
        add(aid, 'actionExpression', attrs.expression, context);
        add(aid, 'assignmentTarget', attrs.targetField, context);
        if (a.key === 'xsf:dialogBoxExpressionAction') add(aid, 'dialogText', a.text, context);
        return { id: aid, kind: localKind(a.key), attrs, ...opt('text', a.text), source: loc(a) };
      });
      rules.push({
        id,
        ruleSet,
        ...opt('caption', r.attrs.caption),
        ...opt('condition', r.attrs.condition),
        enabled: r.attrs.isEnabled !== 'no',
        stopProcessing: r.exitRuleSet,
        actions,
        triggers,
        unresolvedRefs: [],
        source: loc(r),
      });
    }
  }

  // R7.1: calculations.
  const calculations = m.calculations.map((c): IrCalculation => {
    const id = ids.claim(manifestId('calc', c.path), c);
    const target = c.attrs.target ?? '';
    add(id, 'calcTarget', target, DOCUMENT);
    add(id, 'calcExpression', c.attrs.expression, { kind: 'node', path: target });
    return {
      id,
      target,
      expression: c.attrs.expression ?? '',
      ...opt('refresh', c.attrs.refresh),
      unresolvedRefs: [],
      source: loc(c),
    };
  });

  // R7.2: validations, error conditions then blank checks.
  const validation = (
    kind: IrValidation['kind'],
    v: { path: string; attrs: { match?: string; expressionContext?: string; expression?: string } },
    at: IrValidation['source'],
    message?: IrValidation['message'],
  ): IrValidation => {
    const id = ids.claim(manifestId('val', v.path), at);
    const match = v.attrs.match ?? '';
    add(id, 'validationMatch', match, DOCUMENT);
    add(id, 'validationExpression', v.attrs.expression, {
      kind: 'node',
      path: match,
      ...opt('then', v.attrs.expressionContext),
    });
    return {
      id,
      kind,
      match,
      ...opt('expressionContext', v.attrs.expressionContext),
      ...opt('expression', v.attrs.expression),
      ...opt('message', message),
      unresolvedRefs: [],
      source: at,
    };
  };
  const validations = [
    ...m.validations.map((v) =>
      validation(
        'errorCondition',
        v,
        loc(v),
        v.message && {
          ...opt('type', v.message.attrs.type),
          ...opt('shortMessage', v.message.attrs.shortMessage),
          text: v.message.text,
        },
      ),
    ),
    ...m.blankChecks.map((b) => validation('blank', b, loc(b))),
  ];

  // R9.1: code-behind.
  const managed = m.solution.managedCode;
  const languages = [managed?.attrs.language, m.scripts?.attrs.language].filter(
    (l): l is string => l !== undefined,
  );
  const files = [
    ...t.codeFiles,
    ...(m.scripts?.scripts ?? []).map((s) => s.attrs.src).filter((s): s is string => !!s),
  ];
  const handlers = m.domEventHandlers
    .filter((h) => h.attrs.handlerObject !== undefined)
    .map((h) => {
      const id = ids.claim(manifestId('handler', h.path), h);
      const match = h.attrs.match ?? '';
      add(id, 'codeHandler', match, DOCUMENT);
      return { id, match, handler: h.attrs.handlerObject!, source: loc(h) };
    });
  const codeBehind: CodeBehind = {
    present: managed !== undefined || m.scripts !== undefined || t.codeFiles.length > 0,
    languages: [...new Set(languages)],
    files: [...new Set(files)],
    handlers,
  };

  // R9.2: signed data blocks and signature lines.
  const blocks = (m.signatures?.blocks ?? []).map((b) => {
    const id = ids.claim(manifestId('sig', b.path), b);
    add(id, 'signedData', b.attrs.data, DOCUMENT);
    return {
      id,
      ...opt('name', b.attrs.name),
      ...opt('mode', b.attrs.mode),
      ...opt('message', b.message?.text),
      ...opt('data', b.attrs.data),
      source: loc(b),
    };
  });
  const lineSets = [
    ...m.views.flatMap((v) => v.extensions.map((e) => ({ view: v.attrs.name, e }))),
    ...m.unlinkedViewExtensions.map((e) => ({ view: undefined, e })),
  ];
  const signatureLines = lineSets.flatMap(({ view, e }) =>
    e.key === 'xsf3:viewExtension'
      ? e.signatureLines.map((l) => ({
          id: ids.claim(manifestId('sig', l.path), l),
          ...opt('view', view),
          attrs: { ...l.attrs },
          source: loc(l),
        }))
      : [],
  );

  // R4.5: ActiveX controls the manifest allows.
  const allowed = m.allowedControls.map((a) => ({
    id: ids.claim(manifestId('allowed', a.path), a),
    ...opt('clsid', a.attrs.clsid),
    ...opt('cabFile', a.attrs.cabFile),
    source: loc(a),
  }));

  return {
    rules,
    calculations,
    validations,
    codeBehind,
    signatures: { blocks, signatureLines },
    allowed,
    pending,
  };
}
