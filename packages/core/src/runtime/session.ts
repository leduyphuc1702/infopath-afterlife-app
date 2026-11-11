// Spec 04 R1, R2, design D1, D9–D14: a working copy of one record and the change cycle over it.
// Pure: no Worker, no clock (`now` comes with each command), no network.

import { buttonCaptions } from '../dossier/buttons';
import type { FormIR, IrCalculation, IrRule } from '../ir/types';
import { resolveLimits } from '../limits';
import { dataPath } from '../render/marks';
import { packageFiles } from '../render/prepare';
import {
  parseXmlDom,
  serialiseXml,
  xmlContext,
  emptyDocument,
  type DomDocument,
} from '../xml/parse';
import type { ParsedTemplate } from '../xsn/parse';
import { runCycle, type Change, type Dirty, type Step } from './cycle';
import { Evaluator, NotEvaluated, textOf, type RtNode } from './evaluate';
import { fieldIndex, type FieldIndex } from './model';
import { Structure } from './structure';
import { NO_QUERIES, runRuleSet, type RuleEffects, type RuleHost } from './rules';
import { TRACE_CAP, type TraceEntry } from './trace';
import { validate, type Invalid } from './validate';

const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
/** D3: a plain positional child path, optionally ending in an attribute. */
const PATH =
  /^(\/([A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*\[[1-9]\d*\])+(\/@([A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*)?$/;

/** R1.4: a command that names no editable node. Spec 04 task 5 maps it to `FILL_PATH`. */
export class FillCommandError extends Error {
  constructor(
    readonly path: string,
    readonly reason: 'syntax' | 'none' | 'notField' | 'calculated' | 'notGroup' | 'lastRow',
  ) {
    super(`${path}: ${reason}`);
  }
}

export interface FillOptions {
  /** Record bytes; absent: the template's `initialXmlDocument` (R1.1). */
  readonly record?: Uint8Array;
  readonly now: string;
  /** Tests only: skip R1.2 (onLoad and the first recalculation), to read stored values. */
  readonly initial?: false;
}

export interface FillAnswer {
  readonly changes: readonly {
    readonly path: string;
    readonly before: string;
    readonly after: string;
  }[];
  readonly trace: readonly TraceEntry[];
  readonly invalid: readonly Invalid[];
  readonly dialogs: readonly string[];
  readonly notices: readonly string[];
  /** A switch view action's view name. */
  readonly view?: string;
  readonly passes: number;
  readonly loop?: readonly string[];
  /**
   * Spec 04 task 9: after an insert, the new item's path; after a remove, the path of the item
   * that took its place (the next one, else the one before), absent when none is left.
   */
  readonly focus?: string;
}

/** D26: one undo step's state. */
export interface Snapshot {
  readonly main: string;
  readonly secondary: readonly (readonly [string, string])[];
}

export class FillSession {
  private readonly doc: RtNode;
  private readonly index: FieldIndex;
  private readonly evaluator: Evaluator;
  private readonly secondary = new Map<string, unknown>();
  private readonly packageSources = new Map<string, string>();
  private readonly calcSteps: Step<RtNode>[];
  private readonly ruleSteps: Step<RtNode>[];
  private readonly calcTargets: ReadonlySet<string>;
  private readonly structure: Structure;
  private now: string;
  private seq = 0;
  /** Spec 14 B4: true while the record is being opened. */
  private opening = false;
  /** Spec 16 K2: the caption of the button being pressed, for its trace entries. */
  private pressing: string | undefined;
  private captions: Map<string, string> | undefined;
  private pending: TraceEntry[] = [];
  private effects: RuleEffects = { dialogs: [], notices: [] };
  private lastInvalid = new Map<string, string>();
  readonly trace: TraceEntry[] = [];
  /** R1.2: what opening did (onLoad rules, the first recalculation); empty with `initial: false`. */
  readonly opened: FillAnswer;

  private constructor(
    private readonly template: ParsedTemplate,
    private readonly ir: FormIR,
    options: FillOptions,
  ) {
    this.now = options.now;
    const file = packageFiles(template);
    const name = template.manifest.fileNew?.attrs.href;
    const bytes = options.record ?? (name === undefined ? undefined : file(name));
    if (!bytes) throw new FillCommandError('/', 'none');
    const ctx = xmlContext(resolveLimits());
    this.doc = parseXmlDom(bytes, 'record.xml', ctx).doc as unknown as RtNode;
    for (const c of ir.dataConnections) {
      if (c.dataSource === undefined || this.packageSources.has(c.dataSource)) continue;
      const f =
        c.adapterKind === 'xmlFileAdapter'
          ? c.endpoints.find((e) => e.liveness === 'package')?.value
          : undefined;
      this.packageSources.set(c.dataSource, f ?? '');
    }
    const main = ir.fields[0]?.dataSource ?? 'main';
    this.index = fieldIndex(ir, main, template.schemas.main);
    this.evaluator = new Evaluator(
      template.manifest.namespaces,
      (n) => this.source(n, file, ctx),
      this.now,
    );
    this.calcTargets = new Set(ir.calculations.flatMap((c) => (c.targetId ? [c.targetId] : [])));
    this.structure = new Structure(ir, this.doc, (n) => this.index.idOf(n));
    this.calcSteps = this.calculationSteps();
    this.ruleSteps = this.fieldRuleSteps();
    this.opened =
      options.initial !== false
        ? this.start()
        : { changes: [], trace: [], invalid: [], dialogs: [], notices: [], passes: 0 };
  }

  static open(template: ParsedTemplate, ir: FormIR, options: FillOptions): FillSession {
    return new FillSession(template, ir, options);
  }

  /** R1.2: onLoad rule sets, then every calculation, then validation; trace kept. */
  private start(): FillAnswer {
    this.opening = true;
    try {
      return this.startCommand();
    } finally {
      this.opening = false;
    }
  }

  private startCommand(): FillAnswer {
    return this.command(() => {
      const root = this.doc.documentElement!;
      const changes: Change<RtNode>[] = [];
      for (const rules of this.ruleSets((r) => r.triggers.some((t) => t.kind === 'onLoad')))
        changes.push(...runRuleSet(rules, root, undefined, this.ruleHost()));
      return [...changes, ...this.calculateAll()];
    });
  }

  /** R2.1: write `value` at `path` and run the cycle. */
  edit(path: string, value: string, now = this.now): FillAnswer {
    const node = this.resolve(path);
    this.now = now;
    this.evaluator.setNow(now);
    return this.command(() => {
      const c = this.write(node, value);
      return c ? [c] : [];
    });
  }

  /** R4.4: the rule sets bound to a button's `CtrlId`, with `path`'s node (or the root) as context. */
  press(ctrlId: string, path?: string, now = this.now): FillAnswer {
    const ctx = path === undefined ? this.doc.documentElement! : this.resolve(path, true);
    this.now = now;
    this.evaluator.setNow(now);
    this.captions ??= buttonCaptions(this.template);
    this.pressing = this.captions.get(ctrlId) ?? ctrlId;
    try {
      return this.command(() => {
        const changes: Change<RtNode>[] = [];
        for (const rules of this.ruleSets((r) =>
          r.triggers.some((t) => t.kind === 'button' && t.button === ctrlId),
        ))
          changes.push(...runRuleSet(rules, ctx, undefined, this.ruleHost()));
        return changes;
      });
    } finally {
      this.pressing = undefined;
    }
  }

  // --- rows and optional sections (spec 04 task 9, D19) ---------------------------------------

  /**
   * R7.1, R7.2: a new item of `groupId`. `at.in` is the context node of an "Insert item"
   * placeholder (after the last item); `at.row` with `where` inserts beside an existing item.
   */
  insertRow(
    groupId: string,
    at: { readonly in: string } | { readonly row: string; readonly where: 'before' | 'after' },
    now = this.now,
  ): FillAnswer {
    const g = this.insertable(groupId, 'xCollection');
    const ref = 'in' in at ? this.resolve(at.in, true) : this.item(g, at.row);
    return this.structural(now, () =>
      'in' in at ? this.structure.append(g, ref) : this.structure.beside(g, ref, at.where),
    );
  }

  /** R7.2: removes the item at `path`; `FILL_PATH lastRow` when the schema needs one. */
  removeRow(path: string, now = this.now): FillAnswer {
    return this.removeItem(path, 'xCollection', now);
  }

  /** R7.3: inserts the absent `xOptional` section `groupId` under the node at `inPath`. */
  insertOptional(groupId: string, inPath: string, now = this.now): FillAnswer {
    const g = this.insertable(groupId, 'xOptional');
    const ctx = this.resolve(inPath, true);
    return this.structural(now, () => this.structure.append(g, ctx));
  }

  /** R7.3: removes the optional section at `path`. */
  removeOptional(path: string, now = this.now): FillAnswer {
    return this.removeItem(path, 'xOptional', now);
  }

  private removeItem(path: string, kind: 'xCollection' | 'xOptional', now: string): FillAnswer {
    const node = this.resolve(path, true);
    const id = this.index.idOf(node);
    const g = id === undefined ? undefined : this.index.group(id);
    if (!g || g.insert?.component !== kind) throw new FillCommandError(path, 'notGroup');
    const r = this.structure.remove(g, node);
    if (!r.ok) throw new FillCommandError(path, 'lastRow');
    return this.structural(now, () => r.next);
  }

  private insertable(groupId: string, kind: 'xCollection' | 'xOptional') {
    const g = this.index.group(groupId);
    if (!g || g.insert?.component !== kind) throw new FillCommandError(groupId, 'notGroup');
    return g;
  }

  private item(g: { readonly id: string }, path: string): RtNode {
    const n = this.resolve(path, true);
    if (this.index.idOf(n) !== g.id) throw new FillCommandError(path, 'notGroup');
    return n;
  }

  /** D19: the change, then every calculation and the cycle, as one command. */
  private structural(now: string, change: () => RtNode | undefined): FillAnswer {
    this.now = now;
    this.evaluator.setNow(now);
    let focus: RtNode | undefined;
    const answer = this.command(() => {
      focus = change();
      return this.calculateAll();
    });
    return focus ? { ...answer, focus: this.pathOf(focus) } : answer;
  }

  /** Every calculation once, then the cycle; P18 calls it twice. */
  recalculate(): FillAnswer {
    return this.command(() => this.calculateAll());
  }

  invalid(): readonly Invalid[] {
    return this.validateNow(false);
  }

  /** Stored text of every node of a field, in document order. */
  values(fieldId: string): string[] {
    return (this.index.nodes(this.doc).get(fieldId) ?? []).map(textOf);
  }

  /** Mark paths of every node of a field or group, in document order (spec 04 task 9). */
  paths(id: string): string[] {
    return (this.index.nodes(this.doc).get(id) ?? []).map((n) => this.pathOf(n));
  }

  /** The text at a mark path, or undefined when it selects no node (spec 04 task 5). */
  text(path: string): string | undefined {
    if (!PATH.test(path)) return undefined;
    try {
      const n = this.evaluator.nodes(path, this.doc);
      return n.length === 1 ? textOf(n[0]!) : undefined;
    } catch {
      return undefined;
    }
  }

  /** A calculated field's target: shown, never edited (R6.2). */
  calculated(fieldId: string): boolean {
    return this.calcTargets.has(fieldId);
  }

  xml(): string {
    return serialiseXml(this.doc as unknown as DomDocument);
  }

  /** D26: the main record and every loaded secondary source, as text. */
  snapshot(): Snapshot {
    const secondary: [string, string][] = [];
    for (const [name, d] of this.secondary)
      if ((d as RtNode | undefined)?.documentElement)
        secondary.push([name, serialiseXml(d as DomDocument)]);
    return { main: this.xml(), secondary };
  }

  /**
   * D26: puts a snapshot back in place (the same document objects, new root elements), then
   * validates again. No rule or calculation runs.
   */
  restore(s: Snapshot): FillAnswer {
    const ctx = xmlContext(resolveLimits());
    const put = (into: RtNode, text: string, name: string) => {
      const from = parseXmlDom(new TextEncoder().encode(text), name, ctx).doc as unknown as RtNode;
      const d = into as RtNode & {
        importNode(n: RtNode, deep: boolean): RtNode;
        replaceChild(a: RtNode, b: RtNode): void;
      };
      d.replaceChild(d.importNode(from.documentElement!, true), into.documentElement!);
    };
    put(this.doc, s.main, 'record.xml');
    for (const [name, text] of s.secondary) {
      const d = this.secondary.get(name) as RtNode | undefined;
      if (d?.documentElement) put(d, text, name);
    }
    this.pending = [];
    const invalid = this.validateNow(false);
    this.lastInvalid = new Map(invalid.map((i) => [i.path, i.short]));
    return { changes: [], trace: [], invalid, dialogs: [], notices: [], passes: 0 };
  }

  // --- the cycle -----------------------------------------------------------------------------

  private command(seedOf: () => Change<RtNode>[]): FillAnswer {
    this.pending = [];
    this.effects = { dialogs: [], notices: [] };
    const seed = seedOf();
    const dirty = new Map<string, RtNode[]>();
    for (const c of seed) dirty.set(c.id, [...(dirty.get(c.id) ?? []), c.node]);
    const r = runCycle([...this.ruleSteps, ...this.calcSteps], dirty);
    if (r.loop)
      this.add({
        kind: 'loop',
        caption: 'Possible rule loop',
        note: `Still changing after ${r.passes} passes: ${r.loop.join(', ')}`,
        changes: [],
      });
    const invalid = this.validateNow(true);
    const changes = [...seed, ...r.changes].map(({ path, before, after }) => ({
      path,
      before,
      after,
    }));
    return {
      changes,
      trace: this.pending,
      invalid,
      dialogs: this.effects.dialogs,
      notices: this.effects.notices,
      ...(this.effects.view === undefined ? {} : { view: this.effects.view }),
      passes: r.passes,
      ...(r.loop ? { loop: r.loop } : {}),
    };
  }

  private calculateAll(): Change<RtNode>[] {
    const all = new Map(
      this.ir.calculations.flatMap((c) =>
        c.targetId ? [[c.targetId, this.index.nodes(this.doc).get(c.targetId) ?? []] as const] : [],
      ),
    );
    return this.calcSteps.flatMap((s) => s.run(all));
  }

  /** D9, D11: one step per calculation, in dependency order. */
  private calculationSteps(): Step<RtNode>[] {
    const reads = new Map<string, Set<string>>();
    for (const r of this.ir.dependencies.references) {
      const c = this.ir.calculations.find((x) => x.id === r.elementId);
      if (!c || r.targetId === c.targetId) continue;
      (reads.get(c.id) ?? reads.set(c.id, new Set()).get(c.id)!).add(r.targetId);
    }
    const ordered = topological(this.ir.calculations, (c) => reads.get(c.id) ?? new Set());
    return ordered.map((c) => ({
      id: c.id,
      reads: reads.get(c.id) ?? new Set(),
      run: (dirty: Dirty<RtNode>) => {
        if (!c.targetId) return [];
        const out: Change<RtNode>[] = [];
        // Spec 04 task 11: the first changed input this calculation reads, for "because …".
        const cause = [...(reads.get(c.id) ?? [])].map((id) => dirty.get(id)?.[0]).find(Boolean);
        const trigger = cause && this.pathOf(cause);
        for (const node of this.index.nodes(this.doc).get(c.targetId) ?? []) {
          let value: string;
          try {
            value = this.evaluator.string(c.expression, node);
          } catch (e) {
            if (!(e instanceof NotEvaluated)) throw e;
            this.add({ kind: 'notEvaluated', caption: c.target, note: e.message, changes: [] });
            continue;
          }
          // Spec 14 B4: at open, a stored number that equals the new one at the precision it
          // was stored with stays as stored (InfoPath recalculates on change only).
          // Later, a number equal to the stored one but for float noise is not a change either.
          const stored = textOf(node);
          if (this.opening ? sameAtStoredPrecision(stored, value) : sameNumber(stored, value))
            continue;
          const ch = this.write(node, value);
          if (ch) {
            out.push(ch);
            this.add({
              kind: 'calc',
              // Spec 16 K13: at open nothing changed; the stored value is the cause.
              trigger: this.opening ? undefined : trigger,
              ...(this.opening && { opened: true as const }),
              caption: this.pathOf(node),
              note: c.expression,
              changes: [{ path: ch.path, before: ch.before, after: ch.after }],
            });
          }
        }
        return out;
      },
    }));
  }

  /** D13: field-change rule sets, one step per (rule set, field). */
  private fieldRuleSteps(): Step<RtNode>[] {
    const out: Step<RtNode>[] = [];
    const byKey = new Map<string, IrRule[]>();
    for (const r of this.ir.rules)
      for (const t of r.triggers)
        if (t.kind === 'fieldChange' && t.targetId) {
          const k = `${r.ruleSet}\u0000${t.targetId}`;
          const list = byKey.get(k) ?? [];
          if (!list.includes(r)) list.push(r);
          byKey.set(k, list);
        }
    for (const [k, rules] of byKey) {
      const field = k.split('\u0000')[1]!;
      out.push({
        id: k,
        reads: new Set([field]),
        run: (dirty: Dirty<RtNode>) =>
          (dirty.get(field) ?? []).flatMap((n) =>
            runRuleSet(rules, n, this.pathOf(n), this.ruleHost()),
          ),
      });
    }
    return out;
  }

  private ruleSets(pick: (r: IrRule) => boolean): IrRule[][] {
    const sets = new Map<string, IrRule[]>();
    for (const r of this.ir.rules)
      if (pick(r)) sets.set(r.ruleSet, [...(sets.get(r.ruleSet) ?? []), r]);
    return [...sets.values()];
  }

  private ruleHost(): RuleHost {
    return {
      evaluator: this.evaluator,
      write: (n, v) => this.write(n, v),
      trace: (e) => this.add(e),
      pathOf: (n) => this.pathOf(n),
      effects: this.effects,
    };
  }

  // --- nodes --------------------------------------------------------------------------------

  /** D14: text of an element or attribute; xsi:nil follows the value. */
  private write(node: RtNode, value: string): Change<RtNode> | undefined {
    const before = textOf(node);
    if (before === value) return undefined;
    const id = this.index.idOf(node) ?? `node:${this.pathOf(node)}`;
    if (node.nodeType === 2) node.value = value;
    else {
      const el = node as RtNode & { setAttributeNS(ns: string, q: string, v: string): void };
      while (el.firstChild) el.removeChild!(el.firstChild);
      if (value !== '') el.appendChild!(el.ownerDocument!.createTextNode(value));
      const schema = this.index.schema(id);
      const typed = (this.index.field(id)?.xsdType?.builtin ?? 'xsd:string') !== 'xsd:string';
      if (value !== '') el.removeAttributeNS?.(XSI, 'nil');
      else if (schema?.effective.nillable && typed) el.setAttributeNS(XSI, 'xsi:nil', 'true');
    }
    return { id, node, path: this.pathOf(node), before, after: value };
  }

  private resolve(path: string, group = false): RtNode {
    if (!PATH.test(path)) throw new FillCommandError(path, 'syntax');
    let nodes: RtNode[];
    try {
      nodes = this.evaluator.nodes(path, this.doc);
    } catch {
      throw new FillCommandError(path, 'syntax');
    }
    if (nodes.length !== 1) throw new FillCommandError(path, 'none');
    const id = this.index.idOf(nodes[0]!);
    if (id === undefined || (!group && !this.index.field(id)))
      throw new FillCommandError(path, 'notField');
    if (!group && this.calcTargets.has(id)) throw new FillCommandError(path, 'calculated');
    return nodes[0]!;
  }

  private pathOf(n: RtNode): string {
    return dataPath(n, this.template.manifest.namespaces) ?? '';
  }

  /** D8, R3.4: a secondary source's document; a query source is empty, said once. */
  private source(
    name: string,
    file: (n: string) => Uint8Array | undefined,
    ctx: ReturnType<typeof xmlContext>,
  ): unknown {
    const hit = this.secondary.get(name);
    if (hit !== undefined) return hit;
    if (!this.packageSources.has(name)) return undefined;
    const f = this.packageSources.get(name)!;
    const bytes = f === '' ? undefined : file(f);
    let doc: unknown;
    if (bytes) doc = parseXmlDom(bytes, f, ctx).doc;
    else {
      doc = emptyDocument();
      this.add({ kind: 'skipped', caption: `GetDOM("${name}")`, note: NO_QUERIES, changes: [] });
    }
    this.secondary.set(name, doc);
    return doc;
  }

  private validateNow(traced: boolean): Invalid[] {
    const invalid = validate({
      ir: this.ir,
      index: this.index,
      evaluator: this.evaluator,
      doc: this.doc,
      pathOf: (n) => this.pathOf(n),
      notEvaluated: (caption, note) =>
        traced && this.add({ kind: 'notEvaluated', caption, note, changes: [] }),
    });
    if (traced) {
      const now = new Map(invalid.map((i) => [i.path, i.short]));
      for (const [p, s] of now)
        if (this.lastInvalid.get(p) !== s)
          this.add({ kind: 'validation', trigger: p, caption: s, condition: true, changes: [] });
      for (const [p, s] of this.lastInvalid)
        if (!now.has(p))
          this.add({ kind: 'validation', trigger: p, caption: s, condition: false, changes: [] });
      this.lastInvalid = now;
    }
    return invalid;
  }

  private add(e: Omit<TraceEntry, 'seq' | 'at'>): void {
    const entry: TraceEntry = {
      seq: ++this.seq,
      at: this.now,
      ...e,
      ...(this.pressing !== undefined &&
        (e.kind === 'rule' || e.kind === 'skipped') && { button: this.pressing }),
    };
    this.pending.push(entry);
    this.trace.push(entry);
    if (this.trace.length > TRACE_CAP) this.trace.splice(0, this.trace.length - TRACE_CAP);
  }
}

/** Spec 14 B4: "1423.94" and "1423.9399999999998"; "350.30" and "350.3". */
export function sameAtStoredPrecision(stored: string, value: string): boolean {
  if (stored === value) return true;
  const NUM = /^-?\d+(\.\d+)?$/;
  if (!NUM.test(stored.trim()) || !NUM.test(value.trim())) return false;
  const places = stored.trim().split('.')[1]?.length ?? 0;
  return Number(stored).toFixed(places) === Number(value).toFixed(places);
}

/** Spec 14 B4: equal numbers, allowing for float noise ("1423.94", "1423.9399999999998"). */
export function sameNumber(stored: string, value: string): boolean {
  if (stored === value) return true;
  const NUM = /^-?\d+(\.\d+)?$/;
  if (!NUM.test(stored.trim()) || !NUM.test(value.trim())) return false;
  const a = Number(stored);
  const b = Number(value);
  return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Kahn's order over calculations; those on a cycle follow in manifest order (D9). */
function topological(
  calcs: readonly IrCalculation[],
  reads: (c: IrCalculation) => ReadonlySet<string>,
): IrCalculation[] {
  const out: IrCalculation[] = [];
  const left = new Set(calcs);
  let progress = true;
  while (left.size > 0 && progress) {
    progress = false;
    for (const c of left) {
      const blocked = [...left].some(
        (o) => o !== c && o.targetId !== undefined && reads(c).has(o.targetId),
      );
      if (!blocked) {
        out.push(c);
        left.delete(c);
        progress = true;
      }
    }
  }
  return [...out, ...left];
}
