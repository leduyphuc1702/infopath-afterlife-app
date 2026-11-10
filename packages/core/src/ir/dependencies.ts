// Stage 7: the dependency index (spec 02 R11.2–R11.5, design §7.2, §7.4). Every pending manifest
// expression is resolved against its context; view bindings and choice lists come resolved from
// the scan. Each resolved path is a Reference and one DepRef on its target; each failure is an
// UnresolvedRef on its element (when the element has the list) and an UNRESOLVED_REFERENCE issue.

import type { Issue } from '../errors';
import type { ParsedTemplate } from '../xsn/parse';
import type { DataTree } from './data-tree';
import type { ElementParts, ExprContext, PendingExpr } from './elements';
import {
  DEP_ROLES,
  type DepRef,
  type DepRole,
  type IrConnection,
  type IrField,
  type IrGroup,
  type Reference,
  type UnresolvedRef,
} from './types';
import type { ScannedControl } from './views/scan';
import {
  contextFor,
  manifestScope,
  resolveExpression,
  type Ctx,
  type FailedRef,
  type ResolvedRef,
  type ResolveEnv,
} from './xpath/resolve';

/** Roles that write their target (design §5 notes); `binding` writes unless read-only. */
const WRITES = new Set<DepRole>(['assignmentTarget', 'calcTarget', 'binding']);

export interface DependencyInput {
  readonly t: ParsedTemplate;
  readonly tree: DataTree;
  readonly fields: readonly IrField[];
  readonly elements: ElementParts;
  readonly connections: readonly IrConnection[];
  readonly connectionPending: readonly PendingExpr[];
  readonly controls: readonly ScannedControl[];
}

export interface DependencyParts {
  readonly fields: IrField[];
  readonly groups: IrGroup[];
  readonly references: Reference[];
  readonly elements: ElementParts;
  readonly connections: IrConnection[];
  readonly issues: Issue[];
}

interface Resolved {
  readonly elementId: string;
  readonly role: DepRole;
  readonly refs: readonly ResolvedRef[];
  readonly unresolved: readonly FailedRef[];
  /** The target when the whole string is one path that resolved (in every context). */
  readonly whole?: string;
  readonly write: boolean;
}

const key = (r: { targetId: string; text: string }) => `${r.targetId}\u0000${r.text}`;

export function buildDependencies(input: DependencyInput): DependencyParts {
  const { t, tree, elements } = input;
  const env: ResolveEnv = { index: tree.index, parentOf: tree.parentOf };
  const scope = manifestScope(t.manifest.namespaces);
  const doc: Ctx = { ds: 'main', node: null };
  const mainRoot = tree.index.roots.get('main');
  const nowhere: Ctx = { ds: '\u0000', node: null };

  // Each rule set's contexts: the nodes of its fieldChange triggers, else the main root.
  const ruleSetContexts = new Map<string, Ctx[]>();
  for (const r of elements.rules) {
    if (ruleSetContexts.has(r.ruleSet)) continue;
    const ctxs: Ctx[] = [];
    for (const tr of r.triggers) {
      if (tr.kind !== 'fieldChange') continue;
      const c = contextFor(tr.match, undefined, scope, env);
      if ('node' in c && !ctxs.some((x) => x.ds === c.ds && x.node === c.node)) ctxs.push(c);
    }
    ruleSetContexts.set(r.ruleSet, ctxs);
  }
  const contexts = (c: ExprContext): Ctx[] => {
    switch (c.kind) {
      case 'document':
        return [doc];
      case 'mainRoot':
        return [mainRoot === undefined ? nowhere : { ds: 'main', node: mainRoot }];
      case 'node': {
        const at = contextFor(c.path, c.then, scope, env);
        return ['node' in at ? at : nowhere];
      }
      case 'ruleSet': {
        const list = ruleSetContexts.get(c.name) ?? [];
        return list.length ? list : contexts({ kind: 'mainRoot' });
      }
    }
  };

  const resolvePending = (p: PendingExpr): Resolved => {
    // Every path occurrence of the first context; another context adds only new targets.
    const refs: ResolvedRef[] = [];
    const unresolved: FailedRef[] = [];
    const wholes = new Set<string | undefined>();
    contexts(p.context).forEach((ctx, i) => {
      const r = resolveExpression(p.text, ctx, scope, env);
      const seen = new Set(refs.map(key));
      for (const x of r.refs) if (i === 0 || !seen.has(key(x))) refs.push(x);
      for (const u of r.unresolved) {
        if (i === 0 || !unresolved.some((v) => v.text === u.text && v.reason === u.reason))
          unresolved.push(u);
      }
      wholes.add(r.whole);
    });
    const whole = wholes.size === 1 ? [...wholes][0] : undefined;
    return {
      elementId: p.elementId,
      role: p.role,
      refs,
      unresolved,
      ...(whole === undefined ? {} : { whole }),
      write: WRITES.has(p.role),
    };
  };

  // Element order of the FormIR arrays (design §7.4): views, rules and their actions,
  // calculations, validations, connections, code handlers, signed data blocks.
  const order = new Map<string, number>();
  const at = (id: string) => order.has(id) || order.set(id, order.size);
  for (const c of input.controls) at(c.control.id);
  for (const r of elements.rules) {
    at(r.id);
    for (const a of r.actions) at(a.id);
  }
  for (const c of elements.calculations) at(c.id);
  for (const v of elements.validations) at(v.id);
  for (const c of input.connections) at(c.id);
  for (const h of elements.codeBehind.handlers) at(h.id);
  for (const b of elements.signatures.blocks) at(b.id);
  const rank = (id: string) => order.get(id) ?? order.size;

  const pending = [...elements.pending, ...input.connectionPending]
    .map((p, i) => ({ p, i }))
    .sort((x, y) => rank(x.p.elementId) - rank(y.p.elementId) || x.i - y.i)
    .map(({ p }) => resolvePending(p));
  const fromViews: Resolved[] = input.controls.flatMap((c) => [
    {
      elementId: c.control.id,
      role: 'binding' as const,
      refs: c.refs,
      unresolved: [],
      write: !c.control.readOnly,
    },
    ...(c.choiceRefs.length
      ? [
          {
            elementId: c.control.id,
            role: 'choicesFilter' as const,
            refs: c.choiceRefs,
            unresolved: [],
            write: false,
          },
        ]
      : []),
  ]);
  const all = [...fromViews, ...pending];

  // References and per-node DepRefs.
  const references: Reference[] = [];
  const readBy = new Map<string, DepRef[]>();
  const writtenBy = new Map<string, DepRef[]>();
  const push = (m: Map<string, DepRef[]>, id: string, d: DepRef) => {
    const list = m.get(id) ?? [];
    if (!list.some((x) => x.elementId === d.elementId && x.role === d.role)) list.push(d);
    m.set(id, list);
  };
  for (const r of all) {
    for (const ref of r.refs) {
      references.push({
        elementId: r.elementId,
        role: r.role,
        targetId: ref.targetId,
        text: ref.text,
      });
      const d = { elementId: r.elementId, role: r.role };
      if (r.write) push(writtenBy, ref.targetId, d);
      if (!r.write || r.role === 'binding') push(readBy, ref.targetId, d);
    }
  }
  const roleRank = (d: DepRef) => DEP_ROLES.indexOf(d.role);
  const sorted = (list: DepRef[] | undefined): DepRef[] =>
    [...(list ?? [])].sort(
      (a, b) => roleRank(a) - roleRank(b) || rank(a.elementId) - rank(b.elementId),
    );
  const withDeps = <N extends IrField | IrGroup>(n: N): N => ({
    ...n,
    dependencies: { readBy: sorted(readBy.get(n.id)), writtenBy: sorted(writtenBy.get(n.id)) },
  });

  // Unresolved references: on the element when it has the list, and always an issue.
  const issues: Issue[] = [];
  const unresolvedOf = new Map<string, UnresolvedRef[]>();
  for (const r of pending) {
    for (const u of r.unresolved) {
      const list = unresolvedOf.get(r.elementId) ?? [];
      list.push({ role: r.role, text: u.text, reason: u.reason });
      unresolvedOf.set(r.elementId, list);
      issues.push({
        code: 'UNRESOLVED_REFERENCE',
        message: `${u.text} in ${r.elementId} (${r.role}) not resolved: ${u.reason}`,
        details: {
          kind: 'expression',
          reason: u.reason,
          elementId: r.elementId,
          role: r.role,
          text: u.text,
        },
      });
    }
  }
  const wholeOf = (elementId: string, role: DepRole) =>
    pending.find((r) => r.elementId === elementId && r.role === role)?.whole;

  // Fill the …Id properties from the whole-path resolutions.
  const actionOwner = new Map<string, string>();
  for (const r of elements.rules) for (const a of r.actions) actionOwner.set(a.id, r.id);
  const unresolvedFor = (id: string): UnresolvedRef[] => [
    ...(unresolvedOf.get(id) ?? []),
    ...[...actionOwner]
      .filter(([, rule]) => rule === id)
      .flatMap(([a]) => unresolvedOf.get(a) ?? []),
  ];
  const absolute = (match: string) => {
    const c = contextFor(match, undefined, scope, env);
    return 'node' in c && c.node !== null ? c.node : undefined;
  };
  const opt = <K extends string>(k: K, v: string | undefined) =>
    (v === undefined ? {} : { [k]: v }) as Partial<Record<K, string>>;

  const rules = elements.rules.map((r) => ({
    ...r,
    triggers: r.triggers.map((tr) =>
      tr.kind === 'fieldChange' ? { ...tr, ...opt('targetId', absolute(tr.match)) } : tr,
    ),
    unresolvedRefs: unresolvedFor(r.id),
  }));
  const calculations = elements.calculations.map((c) => ({
    ...c,
    ...opt('targetId', wholeOf(c.id, 'calcTarget')),
    unresolvedRefs: unresolvedFor(c.id),
  }));
  const validations = elements.validations.map((v) => ({
    ...v,
    ...opt('matchId', wholeOf(v.id, 'validationMatch')),
    unresolvedRefs: unresolvedFor(v.id),
  }));
  const handlers = elements.codeBehind.handlers.map((h) => ({
    ...h,
    ...opt('targetId', wholeOf(h.id, 'codeHandler')),
  }));
  const blocks = elements.signatures.blocks.map((b) => ({
    ...b,
    ...opt('dataId', wholeOf(b.id, 'signedData')),
  }));

  // Lineage: nodes of the connection's data source that any reference reaches, in tree order;
  // the elements with such a reference, then controls whose choicesFrom names the connection.
  const dsOf = new Map<string, string>(
    [...input.fields, ...tree.groups].map((n) => [n.id, n.dataSource]),
  );
  const treeOrder = [...tree.nodeOf.keys()];
  const connections = input.connections.map((c): IrConnection => {
    const ds = c.dataSource;
    const reached = new Set<string>();
    const usedBy: string[] = [];
    if (ds !== undefined) {
      for (const ref of references) {
        if (dsOf.get(ref.targetId) !== ds) continue;
        reached.add(ref.targetId);
        if (!usedBy.includes(ref.elementId)) usedBy.push(ref.elementId);
      }
    }
    for (const ctl of input.controls) {
      if (ctl.control.choicesFrom?.connectionId === c.id && !usedBy.includes(ctl.control.id))
        usedBy.push(ctl.control.id);
    }
    return {
      ...c,
      lineage: { fieldIds: treeOrder.filter((id) => reached.has(id)), usedBy },
      unresolvedRefs: unresolvedOf.get(c.id) ?? [],
    };
  });

  return {
    fields: input.fields.map(withDeps),
    groups: tree.groups.map(withDeps),
    references,
    elements: {
      ...elements,
      rules,
      calculations,
      validations,
      codeBehind: { ...elements.codeBehind, handlers },
      signatures: { ...elements.signatures, blocks },
    },
    connections,
    issues,
  };
}
