// ModelNode tree → typed Manifest (design §8.3). Builders never touch the DOM. Children are read
// only through `take`, `one` and `oneOf`, which mark them consumed; `assertAllConsumed` then
// throws INTERNAL for any modelled node no builder took, because that node would be missing from
// the output while the walker counted it as modelled (§8.4).
//
// A position the Manifest holds once is read with `one` (or `oneOf` for an xsd:choice). It is
// allowed only where MS-IPFF2 itself allows the child once (`once` and `choices` in ms-ipff2.ts),
// or for a `viaWildcard` child, which the parser models once by choice. The first occurrence is
// modelled; each later one becomes an unknown entry with reason `repeated` for its whole subtree
// and a REPEATED_ELEMENT issue (R13.9), so nothing is dropped and the template still opens.

import { AfterlifeError, type Issue } from '../errors';
import type { UnknownEntry } from '../unknown';

import { MS_IPFF2 } from './ms-ipff2';
import type {
  AnyModelled,
  ApplicationParameters,
  ButtonArea,
  Action,
  ActionKey,
  Adapter,
  AdapterChildKey,
  AdapterKey,
  ConnectionExtension,
  ConnectionExtensionKey,
  DataObject,
  ContainerKey,
  EditWith,
  ErrorCondition,
  ErrorMessage,
  EventBinding,
  Manifest,
  MergedPrintView,
  Modelled,
  PackageEntry,
  PrintSettings,
  RawXml,
  MembershipKey,
  Roles,
  Rule,
  RuleSet,
  Scripts,
  SignatureLine,
  Signatures,
  SchemaErrorMessages,
  Solution,
  SpecKey,
  Submit,
  View,
  ViewExtension,
  WithText,
  XmlToEdit,
} from './types';
import { XSF_VOCABULARY, type ElementSpec } from './vocabulary';
import { unknownElement, type ModelNode } from './walk';

// ---- consumption ------------------------------------------------------------------------------

export class BuildContext {
  private readonly consumed = new Set<ModelNode>();
  private readonly order = new Map<ModelNode, number>();
  private readonly grouping: ModelNode[] = [];
  /** Later occurrences of held-once elements (R13.9). */
  readonly repeated: UnknownEntry[] = [];
  readonly issues: Issue[] = [];

  constructor(readonly root: ModelNode) {
    const visit = (n: ModelNode) => {
      this.order.set(n, this.order.size);
      n.children.forEach(visit);
    };
    visit(root);
    this.consumed.add(root);
  }

  /** Every child of `node` at position `key`, in document order. */
  take(node: ModelNode, key: SpecKey): ModelNode[] {
    const out = node.children.filter((c) => c.key === key);
    for (const c of out) this.consumed.add(c);
    return out;
  }

  /** The first child at `key`, which MS-IPFF2 allows once here; later ones are `repeated`. */
  one(node: ModelNode, key: SpecKey): ModelNode | undefined {
    if (!allowsOnce(node.key, key)) {
      throw new AfterlifeError('INTERNAL', {
        path: node.path,
        reason: `one(${key}) on a position MS-IPFF2 does not hold once`,
      });
    }
    return this.first(this.take(node, key), node.path, { rule: 'MS-IPFF2' });
  }

  /** The first child among `keys`, members of one xsd:choice that occurs once (R13.9). */
  oneOf(node: ModelNode, keys: readonly SpecKey[]): ModelNode | undefined {
    const choice = MS_IPFF2[node.key]?.choices?.find((g) => keys.every((k) => g.includes(k)));
    if (!choice) {
      throw new AfterlifeError('INTERNAL', {
        path: node.path,
        reason: `oneOf(${keys.join(', ')}) is not one xsd:choice of ${node.key} in MS-IPFF2`,
      });
    }
    const found = node.children.filter((c) => (keys as readonly string[]).includes(c.key));
    for (const c of found) this.consumed.add(c);
    return this.first(found, node.path, { rule: 'MS-IPFF2', choice: keys.map(qnameOf).join(', ') });
  }

  /**
   * The first of `nodes` (document order); every later one becomes one `repeated` unknown entry
   * for its subtree plus a REPEATED_ELEMENT issue. `rule` says who allows only one: MS-IPFF2, or
   * the parser (the solution definitions inside the `xsf:extension` wildcard).
   */
  first(
    nodes: readonly ModelNode[],
    parentPath: string,
    how: { rule: 'MS-IPFF2' | 'parser'; choice?: string },
  ): ModelNode | undefined {
    for (const later of nodes.slice(1)) {
      this.consumeSubtree(later);
      this.repeatedNodes.add(later);
      this.repeated.push(unknownElement(later.element, later.file, 'repeated', true));
      const element = qnameOf(later.key);
      const allowed = how.choice === undefined ? element : `one of ${how.choice}`;
      this.issues.push({
        code: 'REPEATED_ELEMENT',
        message: `${later.file}: ${element} at ${later.path} repeats; ${how.rule} allows ${allowed} once in ${parentPath}`,
        file: later.file,
        path: later.path,
        line: later.line,
        column: later.column,
        details: {
          element,
          parent: parentPath,
          allowed: 1,
          rule: how.rule,
          ...(how.choice === undefined ? {} : { choice: how.choice }),
        },
      });
    }
    return nodes[0];
  }

  /** Paths of the repeated (not modelled) subtrees. */
  repeatedPaths(): string[] {
    return [...this.repeatedNodes].map((n) => n.path);
  }

  private readonly repeatedNodes = new Set<ModelNode>();

  private consumeSubtree(n: ModelNode): void {
    this.consumed.add(n);
    n.children.forEach((c) => this.consumeSubtree(c));
  }

  /** Records a grouping element (`Manifest.containers`). */
  container(node: ModelNode): void {
    this.consumed.add(node);
    this.grouping.push(node);
  }

  /** `take` plus `container` for each result. */
  takeContainers(node: ModelNode, key: ContainerKey): ModelNode[] {
    const out = this.take(node, key);
    out.forEach((c) => this.grouping.push(c));
    return out;
  }

  containers(): AnyModelled<ContainerKey>[] {
    return [...this.grouping]
      .sort((a, b) => this.order.get(a)! - this.order.get(b)!)
      .map((n) => modelled(n) as AnyModelled<ContainerKey>);
  }

  /** Sorts built objects into document order by the node each came from. */
  inOrder<T>(items: readonly { node: ModelNode; value: T }[]): T[] {
    return [...items]
      .sort((a, b) => this.order.get(a.node)! - this.order.get(b.node)!)
      .map((i) => i.value);
  }

  assertAllConsumed(): void {
    const visit = (n: ModelNode) => {
      if (!this.consumed.has(n)) {
        throw new AfterlifeError('INTERNAL', {
          path: n.path,
          reason: 'a modelled node was not consumed by any builder',
        });
      }
      n.children.forEach(visit);
    };
    visit(this.root);
  }
}

function allowsOnce(parent: string, child: string): boolean {
  if (MS_IPFF2[parent]?.once?.includes(child)) return true;
  const spec: ElementSpec | undefined = (XSF_VOCABULARY as Record<string, ElementSpec>)[parent];
  return Object.values(spec?.children ?? {}).some(
    (c) => typeof c === 'object' && c.key === child && c.viaWildcard,
  );
}

/** `xsf:rule/exitRuleSet` → `xsf:exitRuleSet`. */
function qnameOf(key: string): string {
  const slash = key.lastIndexOf('/');
  return slash < 0 ? key : `${key.slice(0, key.indexOf(':'))}:${key.slice(slash + 1)}`;
}

// ---- conversions ------------------------------------------------------------------------------

export function modelled<K extends SpecKey>(n: ModelNode): Modelled<K> {
  return {
    key: n.key as K,
    file: n.file,
    path: n.path,
    line: n.line,
    column: n.column,
    attrs: n.attrs as Modelled<K>['attrs'],
  };
}

function rawXml<K extends SpecKey>(n: ModelNode): RawXml<K> {
  return { ...modelled<K>(n), raw: n.raw ?? '' };
}

/** Adds `key: value` only when the value is defined (exactOptionalPropertyTypes). */
function opt<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

// ---- the manifest -----------------------------------------------------------------------------

export interface ManifestBuild {
  readonly manifest: Manifest;
  /** `repeated` entries, in document order (R13.9). */
  readonly unknowns: readonly UnknownEntry[];
  /** REPEATED_ELEMENT issues, in document order. */
  readonly issues: readonly Issue[];
  /** Paths of the repeated subtrees; walker entries inside them belong to the repeated entry. */
  readonly repeatedPaths: readonly string[];
}

export function buildManifest(root: ModelNode): ManifestBuild {
  const ctx = new BuildContext(root);
  const R = root;

  const bindings: Ordered<EventBinding>[] = [];
  const solution = buildSolution(ctx, R);
  const views = buildViews(ctx, R, solution.viewExtensions, bindings);
  const domEventHandlers = buildDomEventHandlers(ctx, R, bindings);
  buildOnLoad(ctx, R, bindings);

  // Built in later tasks (spec 01 tasks 14–15).

  const dataObjects = buildDataObjects(ctx, R);
  const mainQuery = buildMainQuery(ctx, R);
  const submit = buildSubmit(ctx, R, bindings);
  const dataAdapters = buildDataAdapters(ctx, R);
  // Every adapter, in document order (one file, so line and column order the elements).
  const adapters = [
    ...(mainQuery ? [mainQuery] : []),
    ...dataObjects.flatMap((d) => (d.query ? [d.query] : [])),
    ...(submit?.adapters ?? []),
    ...dataAdapters,
  ].sort((a, b) => a.line - b.line || a.column - b.column);
  const connectionExtensions = solution.dataConnections
    ? buildConnectionExtensions(ctx, solution.dataConnections, adapters)
    : [];

  const manifest: Manifest = {
    documentClass: modelled(R),
    solution: solution.solution,
    package: buildPackage(ctx, R),
    documentSchemas: buildDocumentSchemas(ctx, R),
    ...opt('fileNew', buildFileNew(ctx, R)),
    ...opt('upgrade', buildUpgrade(ctx, R)),
    ...opt(
      'importParameters',
      mapOpt(ctx.one(R, 'xsf:importParameters'), modelled<'xsf:importParameters'>),
    ),
    applicationParameters: buildApplicationParameters(ctx, R),
    views: views.views,
    ...opt('defaultView', views.defaultView),
    ...opt('mergedPrintView', solution.mergedPrintView),
    unlinkedViewExtensions: views.unlinked,
    ruleSets: buildRuleSets(ctx, R),
    bindings: ctx.inOrder(bindings),
    domEventHandlers,
    calculations: buildCalculations(ctx, R),
    validations: buildValidations(ctx, R),
    blankChecks: solution.blankChecks,
    ...opt('schemaErrorMessages', buildSchemaErrorMessages(ctx, R)),
    dataObjects,
    ...opt('mainQuery', mainQuery),
    ...opt('submit', submit),
    dataAdapters,
    connectionExtensions,
    promotedFields: buildPromotedFields(ctx, R),
    promotedFieldExtensions: solution.promotedFieldExtensions,
    ...opt('signatures', buildSignatures(ctx, R)),
    ...opt('roles', buildRoles(ctx, R)),
    ...opt('scripts', buildScripts(ctx, R)),
    allowedControls: buildAllowedControls(ctx, R),
    containers: [],
  };
  ctx.assertAllConsumed();
  const byPosition = (a: { line?: number; column?: number }, b: typeof a) =>
    (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0);
  return {
    manifest: { ...manifest, containers: ctx.containers() },
    unknowns: [...ctx.repeated].sort(byPosition),
    issues: [...ctx.issues].sort(byPosition),
    repeatedPaths: ctx.repeatedPaths(),
  };
}

interface Ordered<T> {
  node: ModelNode;
  value: T;
}

function mapOpt<T, U>(v: T | undefined, f: (t: T) => U): U | undefined {
  return v === undefined ? undefined : f(v);
}

// ---- R7: identity, package, schemas -----------------------------------------------------------

interface SolutionParts {
  solution: Solution;
  mergedPrintView?: MergedPrintView;
  /** Every view extension, in document order, for linking to views by `ref`. */
  viewExtensions: Ordered<ViewExtension>[];
  /** `xsf3:customValidation/xsf3:errorBlank`. */
  blankChecks: Modelled<'xsf3:errorBlank'>[];
  /** `xsf2:dataConnections`, built once the adapters exist. */
  dataConnections?: ModelNode;
  promotedFieldExtensions: Modelled<'xsf2:fieldExtension'>[];
}

function buildSolution(ctx: BuildContext, R: ModelNode): SolutionParts {
  const extensions = ctx.one(R, 'xsf:extensions');
  if (extensions) ctx.container(extensions);
  const extension = extensions ? ctx.takeContainers(extensions, 'xsf:extension') : [];

  // One solution definition of each version across all xsf:extension elements (viaWildcard).
  const defs2 = extension.map((e) => ctx.one(e, 'xsf2:solutionDefinition')).filter(isDefined);
  const defs3 = extension.map((e) => ctx.one(e, 'xsf3:solutionDefinition')).filter(isDefined);
  const where = (extensions ?? R).path;
  const def2 = ctx.first(defs2, where, { rule: 'parser' });
  const def3 = ctx.first(defs3, where, { rule: 'parser' });

  const viewExtensions: SolutionParts['viewExtensions'] = [];
  let mergedPrintView: MergedPrintView | undefined;
  let server, offline;
  let dataConnections: ModelNode | undefined;
  let managedCode: Modelled<'xsf2:managedCode'> | undefined;
  let promotedFieldExtensions: Modelled<'xsf2:fieldExtension'>[] = [];
  if (def2) {
    server = mapOpt(ctx.one(def2, 'xsf2:server'), modelled<'xsf2:server'>);
    offline = mapOpt(ctx.one(def2, 'xsf2:offline'), modelled<'xsf2:offline'>);
    const ve = ctx.one(def2, 'xsf2:viewsExtension');
    if (ve) {
      ctx.container(ve);
      for (const n of ctx.take(ve, 'xsf2:viewExtension')) {
        viewExtensions.push({ node: n, value: modelled<'xsf2:viewExtension'>(n) });
      }
    }
    const mpv = ctx.one(def2, 'xsf2:mergedPrintView');
    if (mpv) mergedPrintView = buildMergedPrintView(ctx, mpv);
    dataConnections = ctx.one(def2, 'xsf2:dataConnections');
    managedCode = mapOpt(ctx.one(def2, 'xsf2:managedCode'), modelled<'xsf2:managedCode'>);
    const lpe = ctx.one(def2, 'xsf2:listPropertiesExtension');
    if (lpe) {
      ctx.container(lpe);
      const fe = ctx.one(lpe, 'xsf2:fieldsExtension');
      if (fe) {
        ctx.container(fe);
        promotedFieldExtensions = ctx
          .take(fe, 'xsf2:fieldExtension')
          .map(modelled<'xsf2:fieldExtension'>);
      }
    }
  }
  let baseUrl;
  let blankChecks: Modelled<'xsf3:errorBlank'>[] = [];
  if (def3) {
    baseUrl = mapOpt(ctx.one(def3, 'xsf3:baseUrl'), modelled<'xsf3:baseUrl'>);
    const ve = ctx.one(def3, 'xsf3:viewsExtension');
    if (ve) {
      ctx.container(ve);
      for (const n of ctx.take(ve, 'xsf3:viewExtension')) {
        const lines = ctx.one(n, 'xsf3:signatureLines');
        if (lines) ctx.container(lines);
        const signatureLines = lines
          ? ctx.take(lines, 'xsf3:signatureLine').map((l) => buildSignatureLine(ctx, l))
          : [];
        viewExtensions.push({
          node: n,
          value: { ...modelled<'xsf3:viewExtension'>(n), signatureLines },
        });
      }
    }
    const cv = ctx.one(def3, 'xsf3:customValidation');
    if (cv) {
      ctx.container(cv);
      blankChecks = ctx.take(cv, 'xsf3:errorBlank').map(modelled<'xsf3:errorBlank'>);
    }
  }

  const solution: Solution = {
    ...opt('definition', mapOpt(def2, modelled<'xsf2:solutionDefinition'>)),
    runtimeCompatibility: (def2?.attrs.runtimeCompatibility ?? '').split(/\s+/).filter(Boolean),
    ...opt('server', server),
    ...opt('offline', offline),
    ...opt('xsf3', mapOpt(def3, modelled<'xsf3:solutionDefinition'>)),
    ...opt('baseUrl', baseUrl),
    ...opt('managedCode', managedCode),
  };
  return {
    solution,
    ...opt('mergedPrintView', mergedPrintView),
    viewExtensions,
    blankChecks,
    ...opt('dataConnections', dataConnections),
    promotedFieldExtensions,
  };
}

function isDefined<T>(v: T | undefined): v is T {
  return v !== undefined;
}

function buildPackage(ctx: BuildContext, R: ModelNode): PackageEntry[] {
  const pkg = ctx.one(R, 'xsf:package');
  if (!pkg) return [];
  ctx.container(pkg);
  const files = ctx.one(pkg, 'xsf:files');
  if (!files) return [];
  ctx.container(files);
  return ctx.take(files, 'xsf:file').map((f) => {
    const props = ctx.one(f, 'xsf:fileProperties');
    if (props) ctx.container(props);
    return {
      ...modelled<'xsf:file'>(f),
      properties: props ? ctx.take(props, 'xsf:property').map(modelled<'xsf:property'>) : [],
    };
  });
}

function buildDocumentSchemas(ctx: BuildContext, R: ModelNode): Modelled<'xsf:documentSchema'>[] {
  const schemas = ctx.one(R, 'xsf:documentSchemas');
  if (!schemas) return [];
  ctx.container(schemas);
  return ctx.take(schemas, 'xsf:documentSchema').map(modelled<'xsf:documentSchema'>);
}

function buildFileNew(
  ctx: BuildContext,
  R: ModelNode,
): Modelled<'xsf:initialXmlDocument'> | undefined {
  const fileNew = ctx.one(R, 'xsf:fileNew');
  if (!fileNew) return undefined;
  ctx.container(fileNew);
  return mapOpt(ctx.one(fileNew, 'xsf:initialXmlDocument'), modelled<'xsf:initialXmlDocument'>);
}

function buildUpgrade(ctx: BuildContext, R: ModelNode): Modelled<'xsf:useTransform'> | undefined {
  const upgrade = ctx.one(R, 'xsf:documentVersionUpgrade');
  if (!upgrade) return undefined;
  ctx.container(upgrade);
  return mapOpt(ctx.one(upgrade, 'xsf:useTransform'), modelled<'xsf:useTransform'>);
}

function buildApplicationParameters(ctx: BuildContext, R: ModelNode): ApplicationParameters[] {
  return ctx.take(R, 'xsf:applicationParameters').map((p) => ({
    ...modelled<'xsf:applicationParameters'>(p),
    ...opt(
      'solutionProperties',
      mapOpt(ctx.one(p, 'xsf:solutionProperties'), modelled<'xsf:solutionProperties'>),
    ),
  }));
}

// ---- R8: views --------------------------------------------------------------------------------

function buildViews(
  ctx: BuildContext,
  R: ModelNode,
  viewExtensions: SolutionParts['viewExtensions'],
  bindings: Ordered<EventBinding>[],
): { views: View[]; defaultView?: string; unlinked: ViewExtension[] } {
  const viewsNode = ctx.one(R, 'xsf:views');
  if (viewsNode) ctx.container(viewsNode);
  const defaultView = viewsNode?.attrs.default;
  const nodes = viewsNode ? ctx.take(viewsNode, 'xsf:view') : [];

  const linked = new Map<ModelNode, { node: ModelNode; value: ViewExtension }[]>();
  const unlinked: { node: ModelNode; value: ViewExtension }[] = [];
  for (const ext of viewExtensions) {
    const view = nodes.find(
      (v) => v.attrs.name !== undefined && v.attrs.name === ext.value.attrs.ref,
    );
    if (view) linked.set(view, [...(linked.get(view) ?? []), ext]);
    else unlinked.push(ext);
  }

  const views = nodes.map((v): View => ({
    ...modelled<'xsf:view'>(v),
    isDefault: v.attrs.name !== undefined && v.attrs.name === defaultView,
    mainpanes: ctx.take(v, 'xsf:mainpane').map(modelled<'xsf:mainpane'>),
    printSettings: ctx.take(v, 'xsf:printSettings').map((p) => buildPrintSettings(ctx, p)),
    xmlToEdit: ctx
      .takeContainers(v, 'xsf:editing')
      .flatMap((e) => ctx.take(e, 'xsf:xmlToEdit').map((x) => buildXmlToEdit(ctx, x))),
    menuAreas: ctx.take(v, 'xsf:menuArea').map((m) => buildButtonArea<'xsf:menuArea'>(ctx, m)),
    toolbars: ctx.take(v, 'xsf:toolbar').map((t) => buildButtonArea<'xsf:toolbar'>(ctx, t)),
    unboundButtons: ctx.takeContainers(v, 'xsf:unboundControls').flatMap((u) =>
      ctx.take(u, 'xsf:unboundControls/button').map((b) => {
        const button = modelled<'xsf:unboundControls/button'>(b);
        binding(ctx, b, bindings, { kind: 'button', ...opt('view', v.attrs.name), button });
        return button;
      }),
    ),
    extensions: ctx.inOrder(linked.get(v) ?? []),
  }));
  return { views, ...opt('defaultView', defaultView), unlinked: ctx.inOrder(unlinked) };
}

function buildPrintSettings(ctx: BuildContext, p: ModelNode): PrintSettings {
  return {
    ...modelled<'xsf:printSettings'>(p),
    ...opt('header', mapOpt(ctx.one(p, 'xsf:header'), rawXml<'xsf:header'>)),
    ...opt('footer', mapOpt(ctx.one(p, 'xsf:footer'), rawXml<'xsf:footer'>)),
  };
}

function buildMergedPrintView(ctx: BuildContext, m: ModelNode): MergedPrintView {
  const included = ctx.one(m, 'xsf2:includedViews');
  if (included) ctx.container(included);
  return {
    ...modelled<'xsf2:mergedPrintView'>(m),
    ...opt(
      'printSettings',
      mapOpt(ctx.one(m, 'xsf:printSettings'), (p) => buildPrintSettings(ctx, p)),
    ),
    includedViews: included
      ? ctx.take(included, 'xsf2:includedView').map(modelled<'xsf2:includedView'>)
      : [],
  };
}

function buildXmlToEdit(ctx: BuildContext, x: ModelNode): XmlToEdit {
  return {
    ...modelled<'xsf:xmlToEdit'>(x),
    ...opt(
      'editWith',
      mapOpt(ctx.one(x, 'xsf:editWith'), (e) => buildEditWith(ctx, e)),
    ),
  };
}

function buildEditWith(ctx: BuildContext, e: ModelNode): EditWith {
  const fragment = ctx.one(e, 'xsf:fragmentToInsert');
  if (fragment) ctx.container(fragment);
  return {
    ...modelled<'xsf:editWith'>(e),
    fragments: fragment
      ? ctx.take(fragment, 'xsf:chooseFragment').map(rawXml<'xsf:chooseFragment'>)
      : [],
  };
}

function buildButtonArea<K extends 'xsf:menuArea' | 'xsf:toolbar'>(
  ctx: BuildContext,
  n: ModelNode,
): ButtonArea<K> {
  return {
    ...modelled<K>(n),
    buttons: ctx.take(n, 'xsf:button').map(modelled<'xsf:button'>),
  };
}

// ---- R9: rules and bindings -------------------------------------------------------------------

const ACTIONS: readonly ActionKey[] = [
  'xsf:assignmentAction',
  'xsf:dialogBoxMessageAction',
  'xsf:dialogBoxExpressionAction',
  'xsf:switchViewAction',
  'xsf:queryAction',
  'xsf:rule/submitAction',
  'xsf:openNewDocumentAction',
  'xsf:closeDocumentAction',
  'xsf:changeAdapterProperty',
  'xsf:webPartConnectionAction',
  'xsf:signSignatureLineAction',
];

function buildRuleSets(ctx: BuildContext, R: ModelNode): RuleSet[] {
  const sets = ctx.one(R, 'xsf:ruleSets');
  if (!sets) return [];
  ctx.container(sets);
  return ctx.take(sets, 'xsf:ruleSet').map((rs) => ({
    ...modelled<'xsf:ruleSet'>(rs),
    rules: ctx.take(rs, 'xsf:rule').map((r) => buildRule(ctx, r)),
  }));
}

function buildRule(ctx: BuildContext, r: ModelNode): Rule {
  const actions = ACTIONS.flatMap((key) =>
    ctx.take(r, key).map((a): Ordered<Action> => ({ node: a, value: buildAction(a) })),
  );
  const exit = ctx.one(r, 'xsf:rule/exitRuleSet');
  if (exit) ctx.container(exit);
  return { ...modelled<'xsf:rule'>(r), actions: ctx.inOrder(actions), exitRuleSet: !!exit };
}

function buildAction(a: ModelNode): Action {
  const base = modelled(a) as Action;
  return a.text === undefined ? base : { ...base, text: a.text };
}

/** Records the binding of the `xsf:ruleSetAction` under `parent`, if it has one. */
function binding(
  ctx: BuildContext,
  parent: ModelNode,
  bindings: Ordered<EventBinding>[],
  trigger: EventBinding['trigger'],
): void {
  const action = ctx.one(parent, 'xsf:ruleSetAction');
  if (action) {
    bindings.push({ node: action, value: { ...modelled<'xsf:ruleSetAction'>(action), trigger } });
  }
}

function buildDomEventHandlers(
  ctx: BuildContext,
  R: ModelNode,
  bindings: Ordered<EventBinding>[],
): Modelled<'xsf:domEventHandler'>[] {
  const handlers = ctx.one(R, 'xsf:domEventHandlers');
  if (!handlers) return [];
  ctx.container(handlers);
  return ctx.take(handlers, 'xsf:domEventHandler').map((h) => {
    const handler = modelled<'xsf:domEventHandler'>(h);
    binding(ctx, h, bindings, { kind: 'fieldChange', handler });
    return handler;
  });
}

function buildOnLoad(ctx: BuildContext, R: ModelNode, bindings: Ordered<EventBinding>[]): void {
  const onLoad = ctx.one(R, 'xsf:onLoad');
  if (!onLoad) return;
  ctx.container(onLoad);
  binding(ctx, onLoad, bindings, { kind: 'onLoad' });
}

// ---- R10: calculations and validation ---------------------------------------------------------

function buildCalculations(ctx: BuildContext, R: ModelNode): Modelled<'xsf:calculatedField'>[] {
  const calcs = ctx.one(R, 'xsf:calculations');
  if (!calcs) return [];
  ctx.container(calcs);
  return ctx.take(calcs, 'xsf:calculatedField').map(modelled<'xsf:calculatedField'>);
}

function errorMessage(ctx: BuildContext, parent: ModelNode): ErrorMessage | undefined {
  const m = ctx.one(parent, 'xsf:errorMessage');
  return m && { ...modelled<'xsf:errorMessage'>(m), text: m.text ?? '' };
}

function buildValidations(ctx: BuildContext, R: ModelNode): ErrorCondition[] {
  const cv = ctx.one(R, 'xsf:customValidation');
  if (!cv) return [];
  ctx.container(cv);
  return ctx.take(cv, 'xsf:errorCondition').map((c) => ({
    ...modelled<'xsf:errorCondition'>(c),
    ...opt('message', errorMessage(ctx, c)),
  }));
}

function buildSchemaErrorMessages(
  ctx: BuildContext,
  R: ModelNode,
): SchemaErrorMessages | undefined {
  const sem = ctx.one(R, 'xsf:schemaErrorMessages');
  if (!sem) return undefined;
  return {
    ...modelled<'xsf:schemaErrorMessages'>(sem),
    overrides: ctx.take(sem, 'xsf:override').map((o) => ({
      ...modelled<'xsf:override'>(o),
      ...opt('message', errorMessage(ctx, o)),
    })),
  };
}

// ---- R11: data connections and submit ---------------------------------------------------------

const QUERY_ADAPTERS = [
  'xsf:adoAdapter',
  'xsf:sharepointListAdapter',
  'xsf:sharepointListAdapterRW',
  'xsf:webServiceAdapter',
  'xsf:xmlFileAdapter',
] as const satisfies readonly AdapterKey[];

const SUBMIT_ADAPTERS = [
  'xsf:davAdapter',
  'xsf:emailAdapter',
  'xsf:submitToHostAdapter',
  'xsf:useHttpHandler',
  'xsf:useQueryAdapter',
  'xsf:useScriptHandler',
  'xsf:webServiceAdapter',
] as const satisfies readonly AdapterKey[];

const DATA_ADAPTERS = [
  'xsf:adoAdapter',
  'xsf:davAdapter',
  'xsf:emailAdapter',
  'xsf:hwsAdapter',
  'xsf:sharepointListAdapter',
  'xsf:submitToHostAdapter',
  'xsf:webServiceAdapter',
  'xsf:xmlFileAdapter',
] as const satisfies readonly AdapterKey[];

const CREDENTIAL = /(^|;)\s*(password|pwd)\s*=/i;

function buildAdapter(ctx: BuildContext, n: ModelNode, role: Adapter['role']): Adapter {
  // Every modelled descendant, whatever its depth (operation → input), in document order.
  const children: Ordered<AnyModelled<AdapterChildKey>>[] = [];
  const collect = (node: ModelNode) => {
    const spec = (XSF_VOCABULARY as Record<string, ElementSpec>)[node.key]!;
    for (const child of new Set(Object.values(spec.children).map(childKeyOf))) {
      for (const c of ctx.take(node, child as SpecKey)) {
        children.push({
          node: c,
          value: modelled(c),
        });
        collect(c);
      }
    }
  };
  collect(n);
  const connection = n.key === 'xsf:adoAdapter' ? n.attrs.connectionString : undefined;
  return {
    ...(modelled(n) as AnyModelled<AdapterKey>),
    role,
    children: ctx.inOrder(children),
    containsCredential: connection !== undefined && CREDENTIAL.test(connection),
  };
}

function childKeyOf(c: ElementSpec['children'][string]): string {
  return typeof c === 'string' ? c : c.key;
}

function buildDataObjects(ctx: BuildContext, R: ModelNode): DataObject[] {
  const objects = ctx.one(R, 'xsf:dataObjects');
  if (!objects) return [];
  ctx.container(objects);
  return ctx.take(objects, 'xsf:dataObject').map((d) => {
    const query = ctx.one(d, 'xsf:dataObject/query');
    if (query) ctx.container(query);
    const adapter = query && ctx.oneOf(query, QUERY_ADAPTERS);
    return {
      ...modelled<'xsf:dataObject'>(d),
      ...opt('query', adapter && buildAdapter(ctx, adapter, 'query')),
    };
  });
}

function buildMainQuery(ctx: BuildContext, R: ModelNode): Adapter | undefined {
  const query = ctx.one(R, 'xsf:query');
  if (!query) return undefined;
  ctx.container(query);
  const adapter = ctx.oneOf(query, [...QUERY_ADAPTERS, 'xsf:bdcAdapter']);
  return adapter && buildAdapter(ctx, adapter, 'query');
}

function withText<K extends SpecKey>(n: ModelNode | undefined) {
  return n && { ...modelled<K>(n), text: n.text ?? '' };
}

function buildSubmit(
  ctx: BuildContext,
  R: ModelNode,
  bindings: Ordered<EventBinding>[],
): Submit | undefined {
  const s = ctx.one(R, 'xsf:submit');
  if (!s) return undefined;
  binding(ctx, s, bindings, { kind: 'submit' });
  const adapters = SUBMIT_ADAPTERS.flatMap((key) => {
    const n = ctx.one(s, key);
    return n ? [{ node: n, value: buildAdapter(ctx, n, 'submit') }] : [];
  });
  return {
    ...modelled<'xsf:submit'>(s),
    adapters: ctx.inOrder(adapters),
    ...opt(
      'submitAction',
      mapOpt(ctx.one(s, 'xsf:submit/submitAction'), modelled<'xsf:submit/submitAction'>),
    ),
    ...opt(
      'successMessage',
      withText<'xsf:submit/successMessage'>(ctx.one(s, 'xsf:submit/successMessage')),
    ),
    ...opt(
      'errorMessage',
      withText<'xsf:submit/errorMessage'>(ctx.one(s, 'xsf:submit/errorMessage')),
    ),
  };
}

function buildDataAdapters(ctx: BuildContext, R: ModelNode): Adapter[] {
  const da = ctx.one(R, 'xsf:dataAdapters');
  if (!da) return [];
  ctx.container(da);
  const adapters = DATA_ADAPTERS.flatMap((key) =>
    ctx.take(da, key).map((n) => ({ node: n, value: buildAdapter(ctx, n, 'dataAdapter') })),
  );
  return ctx.inOrder(adapters);
}

const EXTENDS: Record<ConnectionExtensionKey, AdapterKey> = {
  'xsf2:adoAdapterExtension': 'xsf:adoAdapter',
  'xsf2:davAdapterExtension': 'xsf:davAdapter',
  'xsf2:emailAdapterExtension': 'xsf:emailAdapter',
  'xsf2:sharepointListAdapterExtension': 'xsf:sharepointListAdapter',
  'xsf2:sharepointListAdapterRWExtension': 'xsf:sharepointListAdapterRW',
  'xsf2:useHttpHandlerExtension': 'xsf:useHttpHandler',
  'xsf2:webServiceAdapterExtension': 'xsf:webServiceAdapter',
  'xsf2:xmlFileAdapterExtension': 'xsf:xmlFileAdapter',
};

function buildConnectionExtensions(
  ctx: BuildContext,
  dc: ModelNode,
  adapters: readonly Adapter[],
): ConnectionExtension[] {
  ctx.container(dc);
  const all = (Object.keys(EXTENDS) as ConnectionExtensionKey[]).flatMap((key) =>
    ctx.take(dc, key).map((n): Ordered<ConnectionExtension> => {
      const kind = EXTENDS[key];
      const ref = (n.attrs as { ref?: string }).ref;
      const target =
        key === 'xsf2:useHttpHandlerExtension'
          ? adapters.find((a) => a.key === kind && a.role === 'submit')
          : adapters.find(
              (a) =>
                a.key === kind && ref !== undefined && (a.attrs as { name?: string }).name === ref,
            );
      // emailAdapterExtension is the one extension with no connectoid in MS-IPFF2.
      const connectoid =
        key === 'xsf2:emailAdapterExtension' ? undefined : ctx.one(n, 'xsf2:connectoid');
      const relativeQuery =
        key === 'xsf2:webServiceAdapterExtension' ? ctx.one(n, 'xsf2:relativeQuery') : undefined;
      return {
        node: n,
        value: {
          ...(modelled(n) as AnyModelled<ConnectionExtensionKey>),
          ...opt('connectoid', mapOpt(connectoid, modelled<'xsf2:connectoid'>)),
          ...opt('relativeQuery', mapOpt(relativeQuery, modelled<'xsf2:relativeQuery'>)),
          ...opt('adapterPath', target?.path),
        },
      };
    }),
  );
  return ctx.inOrder(all);
}

// ---- R12: promoted fields, signatures, roles, code, permissions --------------------------------

function buildPromotedFields(ctx: BuildContext, R: ModelNode): Modelled<'xsf:field'>[] {
  const lp = ctx.one(R, 'xsf:listProperties');
  if (!lp) return [];
  ctx.container(lp);
  const fields = ctx.one(lp, 'xsf:fields');
  if (!fields) return [];
  ctx.container(fields);
  return ctx.take(fields, 'xsf:field').map(modelled<'xsf:field'>);
}

function buildSignatures(ctx: BuildContext, R: ModelNode): Signatures | undefined {
  const ds = ctx.one(R, 'xsf:documentSignatures');
  if (!ds) return undefined;
  return {
    ...modelled<'xsf:documentSignatures'>(ds),
    blocks: ctx.take(ds, 'xsf:signedDataBlock').map((b) => ({
      ...modelled<'xsf:signedDataBlock'>(b),
      ...opt(
        'message',
        withText<'xsf:signedDataBlock/message'>(ctx.one(b, 'xsf:signedDataBlock/message')),
      ),
    })),
  };
}

const SIGNATURE_LINE_TEXT = [
  'confirmationMessage',
  'suggestedSignerName',
  'suggestedSignerTitle',
  'suggestedSignerEmailAddress',
] as const;

function buildSignatureLine(ctx: BuildContext, l: ModelNode): SignatureLine {
  const parts: Partial<Record<(typeof SIGNATURE_LINE_TEXT)[number], WithText<SpecKey>>> = {};
  for (const name of SIGNATURE_LINE_TEXT) {
    const n = ctx.one(l, `xsf3:signatureLine/${name}`);
    const text = n && withText<SpecKey>(n);
    if (text) parts[name] = text;
  }
  return { ...modelled<'xsf3:signatureLine'>(l), ...parts } as SignatureLine;
}

const MEMBERSHIP: readonly MembershipKey[] = [
  'xsf:userName',
  'xsf:group',
  'xsf:getUserNameFromData',
];

function buildRoles(ctx: BuildContext, R: ModelNode): Roles | undefined {
  const roles = ctx.one(R, 'xsf:roles');
  if (!roles) return undefined;
  const m = ctx.one(roles, 'xsf:membership');
  if (m) ctx.container(m);
  const membership = m
    ? MEMBERSHIP.flatMap((key) =>
        ctx.take(m, key).map((n): Ordered<AnyModelled<MembershipKey>> => ({
          node: n,
          value: modelled<MembershipKey>(n),
        })),
      )
    : [];
  return {
    ...modelled<'xsf:roles'>(roles),
    roles: ctx.take(roles, 'xsf:role').map(modelled<'xsf:role'>),
    membership: ctx.inOrder(membership),
  };
}

function buildScripts(ctx: BuildContext, R: ModelNode): Scripts | undefined {
  const s = ctx.one(R, 'xsf:scripts');
  if (!s) return undefined;
  return {
    ...modelled<'xsf:scripts'>(s),
    scripts: ctx.take(s, 'xsf:script').map(modelled<'xsf:script'>),
  };
}

function buildAllowedControls(ctx: BuildContext, R: ModelNode): Modelled<'xsf:allowedControl'>[] {
  const p = ctx.one(R, 'xsf:permissions');
  if (!p) return [];
  ctx.container(p);
  return ctx.take(p, 'xsf:allowedControl').map(modelled<'xsf:allowedControl'>);
}
