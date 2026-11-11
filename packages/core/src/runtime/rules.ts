// Spec 04 R4, design D15: one rule set, in manifest order, against one context node.

import type { IrAction, IrRule } from '../ir/types';
import type { Change } from './cycle';
import { NotEvaluated, textOf, type Evaluator, type RtNode } from './evaluate';
import type { TraceEntry } from './trace';

export const NOT_IN_VIEWER = 'Not available in the viewer. Download the XML instead.';
export const NO_QUERIES = 'Query connections are not available in the viewer.';

export interface RuleEffects {
  readonly dialogs: string[];
  readonly notices: string[];
  view?: string | undefined;
}

export interface RuleHost {
  readonly evaluator: Evaluator;
  /** Writes `value` to `node`; the change, or undefined when the text was already `value`. */
  write(node: RtNode, value: string): Change<RtNode> | undefined;
  trace(entry: Omit<TraceEntry, 'seq' | 'at'>): void;
  pathOf(node: RtNode): string;
  readonly effects: RuleEffects;
}

/** Runs `rules` (one rule set) with `context`; returns the nodes it changed. */
export function runRuleSet(
  rules: readonly IrRule[],
  context: RtNode,
  trigger: string | undefined,
  host: RuleHost,
): Change<RtNode>[] {
  const all: Change<RtNode>[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const caption = rule.caption ?? rule.ruleSet;
    let condition = true;
    if (rule.condition !== undefined) {
      try {
        condition = host.evaluator.boolean(rule.condition, context);
      } catch (e) {
        if (!(e instanceof NotEvaluated)) throw e;
        host.trace({ kind: 'notEvaluated', trigger, caption, note: e.message, changes: [] });
        continue;
      }
    }
    const changes: Change<RtNode>[] = [];
    let stop = false;
    if (condition) {
      for (const a of rule.actions) {
        const r = action(a, context, caption, trigger, host);
        changes.push(...r.changes);
        if (r.stop) {
          stop = true;
          break;
        }
      }
    }
    host.trace({
      kind: 'rule',
      trigger,
      caption,
      condition,
      changes: changes.map(({ path, before, after }) => ({ path, before, after })),
    });
    all.push(...changes);
    if (stop || (condition && rule.stopProcessing)) break;
  }
  return all;
}

function action(
  a: IrAction,
  context: RtNode,
  caption: string,
  trigger: string | undefined,
  host: RuleHost,
): { changes: Change<RtNode>[]; stop?: true } {
  const skip = (note: string) => {
    host.trace({ kind: 'skipped', trigger, caption: `${caption}: ${a.kind}`, note, changes: [] });
    return { changes: [] };
  };
  try {
    switch (a.kind) {
      case 'assignmentAction': {
        const target = host.evaluator.nodes(a.attrs.targetField ?? '', context)[0];
        const value = host.evaluator.string(a.attrs.expression ?? '', context);
        if (!target) return skip(`${a.attrs.targetField ?? ''} selects no field`);
        const c = host.write(target, value);
        return { changes: c ? [c] : [] };
      }
      case 'switchViewAction':
        host.effects.view = a.attrs.view;
        return { changes: [] };
      case 'dialogBoxExpressionAction':
        host.effects.dialogs.push(
          host.evaluator.string(a.text ?? a.attrs.expression ?? '""', context),
        );
        return { changes: [] };
      case 'dialogBoxAction':
        host.effects.dialogs.push(a.text ?? '');
        return { changes: [] };
      case 'exitRuleSet':
        return { changes: [], stop: true };
      case 'queryAction':
        return skip(NO_QUERIES);
      case 'submitAction':
      case 'closeDocumentAction':
        host.effects.notices.push(NOT_IN_VIEWER);
        return skip(NOT_IN_VIEWER);
      default:
        return skip(`${a.kind} is not available in the viewer.`);
    }
  } catch (e) {
    if (!(e instanceof NotEvaluated)) throw e;
    host.trace({
      kind: 'notEvaluated',
      trigger,
      caption: `${caption}: ${a.kind}`,
      note: e.message,
      changes: [],
    });
    return { changes: [] };
  }
}

export { textOf };
