// Stage 5: the static view scan (spec 02 R4, design §6.1, E6, E7). Each view's XSL is read as XML
// and walked once per template context; no XSLT runs. Only the §6.1 constructs are understood: a
// control under anything else is kept, with an UNRESOLVED_BINDING issue.

import { AfterlifeError, ISSUE_CODES, type Issue, type IssueCode } from '../../errors';
import { resolveLimits } from '../../limits';
import type { Located } from '../../unknown';
import type { XmlElement } from '../../xml/node';
import { parseXml, xmlContext } from '../../xml/parse';
import type { ParsedTemplate } from '../../xsn/parse';
import type { DataTree } from '../data-tree';
import { classifyEndpoint } from '../endpoints';
import { manifestId, viewElementId, type IdRegistry } from '../ids';
import type { ActiveXControl, BoundControl, ChoicesFrom, IrConnection, IrView } from '../types';
import {
  elementScope,
  resolveExpression,
  type Ctx,
  type ResolveEnv,
  type ResolvedRef,
} from '../xpath/resolve';
import { parseExpression, XPathLexError } from '../xpath/tokens';
import { attrOf, bindingOf, isHtml, isXsl, textAround, XD } from './cells';

/** Default `viewXmlBytes` (R15). */
export const VIEW_XML_BYTES = 4 * 1024 * 1024;

const CELLS = ['td', 'th'];
const TABLE_PARTS = ['table', 'thead', 'tbody', 'tfoot', 'tr'];

/**
 * An attribute value template (XSLT 1.0 §7.6.2) on a literal result element: `{{` → `{`,
 * `}}` → `}`; a value with an unescaped `{…}` is dynamic (undefined).
 */
export function staticAvt(v: string): string | undefined {
  let out = '';
  for (let i = 0; i < v.length; i++) {
    const c = v[i]!;
    if ((c === '{' || c === '}') && v[i + 1] === c) {
      out += c;
      i++;
    } else if (c === '{') return undefined;
    else out += c;
  }
  return out;
}

/** Where a template or for-each runs: a node, or the reason it is not known. */
type Where = { readonly ctx: Ctx } | { readonly reason: string };

interface Occurrence {
  readonly where: Where;
  /** The node `current()` names. */
  readonly current: Where;
  /** View root to the element; a moded template follows the `apply-templates` that called it. */
  readonly chain: readonly XmlElement[];
  /** Index in `chain` of the innermost repeat point (`apply-templates` or `for-each`), or -1. */
  readonly repeatAt: number;
  /** Modes on the way here, for the call-site check. */
  readonly modes: readonly string[];
}

/** One bound control with what the label step and the dependency index need. */
export interface ScannedControl {
  readonly control: BoundControl;
  readonly view: string;
  readonly file: string;
  readonly element: XmlElement;
  /** First occurrence: view root to the control. */
  readonly chain: readonly XmlElement[];
  readonly repeatAt: number;
  /** Where `control.title` came from (own or the DTPicker's). */
  readonly titleAt?: Located;
  /** Resolved binding references, every call site, text order (role `binding`). */
  readonly refs: readonly ResolvedRef[];
  /** Resolved references of the `choicesFrom` select (role `choicesFilter`). */
  readonly choiceRefs: readonly ResolvedRef[];
}

export interface ViewScan {
  readonly views: IrView[];
  readonly controls: ScannedControl[];
  readonly activeX: ActiveXControl[];
  readonly issues: Issue[];
  /**
   * Scan contexts of every view element with a static `xd:CtrlId`, keyed `view\u0000ctrlId`,
   * distinct, in document order: the context of a button trigger (design §7.2).
   */
  readonly ctrlContexts: Map<string, Ctx[]>;
}

export interface ViewScanInput {
  readonly t: ParsedTemplate;
  readonly tree: DataTree;
  readonly ids: IdRegistry;
  readonly connections: readonly IrConnection[];
  readonly viewXmlBytes?: number;
}

const locOf = (file: string, x: { path: string; line: number; column: number }): Located => ({
  file,
  path: x.path,
  line: x.line,
  column: x.column,
});

export function scanViews(input: ViewScanInput): ViewScan {
  const { t, tree, ids } = input;
  const env: ResolveEnv = { index: tree.index, parentOf: tree.parentOf };
  const files = new Set(t.files.map((f) => f.name.toLowerCase()));
  const xml = xmlContext(resolveLimits({ xmlBytes: input.viewXmlBytes ?? VIEW_XML_BYTES }));
  const out: ViewScan = {
    views: [],
    controls: [],
    activeX: [],
    issues: [],
    ctrlContexts: new Map(),
  };
  let limitHit = false;

  for (const v of t.manifest.views) {
    const name = v.attrs.name ?? '';
    const xslFile = v.mainpanes[0]?.attrs.transform;
    const base = {
      id: ids.claim(manifestId('view', v.path), v),
      name,
      ...(v.attrs.caption === undefined ? {} : { caption: v.attrs.caption }),
      ...(xslFile === undefined ? {} : { xslFile }),
      isDefault: v.isDefault,
      isPrint: v.attrs.printView === 'yes',
      source: { file: v.file, path: v.path, line: v.line, column: v.column },
    };
    // A missing file is already spec 01's MISSING_FILE issue (R5.4); the view is not scanned.
    const file =
      xslFile === undefined
        ? undefined
        : t.files.find((f) => f.name.toLowerCase() === xslFile.toLowerCase());
    if (file === undefined || limitHit) {
      out.views.push({ ...base, scanned: false, controls: [] });
      continue;
    }
    let root: XmlElement;
    try {
      const parsed = parseXml(file.bytes, file.name, xml);
      out.issues.push(...parsed.issues);
      root = parsed.root;
    } catch (e) {
      if (!(e instanceof AfterlifeError) || !ISSUE_CODES.includes(e.code as IssueCode)) throw e;
      const d = e.details as Record<string, unknown>;
      out.issues.push({
        code: e.code as IssueCode,
        message: e.message,
        file: file.name,
        ...(typeof d.line === 'number' ? { line: d.line } : {}),
        ...(typeof d.column === 'number' ? { column: d.column } : {}),
        details: {
          view: name,
          ...Object.fromEntries(
            Object.entries(d).filter(
              (kv): kv is [string, string | number] =>
                typeof kv[1] === 'string' || typeof kv[1] === 'number',
            ),
          ),
        },
      });
      if (e.code === 'LIMIT_EXCEEDED') limitHit = true;
      out.views.push({ ...base, scanned: false, controls: [] });
      continue;
    }
    const scanned = scanOne(root, file.name, name, env, input, files, ids, out.issues);
    for (const [ctrlId, ctxs] of scanned.ctrlContexts)
      out.ctrlContexts.set(`${name}\u0000${ctrlId}`, ctxs);
    out.views.push({ ...base, scanned: true, controls: scanned.controls.map((c) => c.control) });
    out.controls.push(...scanned.controls);
    out.activeX.push(...scanned.activeX);
  }
  return out;
}

function scanOne(
  root: XmlElement,
  file: string,
  view: string,
  env: ResolveEnv,
  input: ViewScanInput,
  packageFiles: ReadonlySet<string>,
  ids: IdRegistry,
  issues: Issue[],
): {
  controls: ScannedControl[];
  activeX: ActiveXControl[];
  ctrlContexts: Map<string, Ctx[]>;
} {
  const order = new Map<XmlElement, number>();
  const number = (e: XmlElement) => {
    order.set(e, order.size);
    for (const c of e.children) if (c.kind === 'element') number(c);
  };
  number(root);

  const templates = root.children.filter(
    (c): c is XmlElement => c.kind === 'element' && isXsl(c, 'template'),
  );
  const moded = new Map<string, XmlElement[]>();
  const roots: XmlElement[] = [];
  for (const tpl of templates) {
    const mode = attrOf(tpl, null, 'mode')?.value;
    if (mode !== undefined) moded.set(mode, [...(moded.get(mode) ?? []), tpl]);
    else if (attrOf(tpl, null, 'match') !== undefined) roots.push(tpl);
  }

  const unresolved = (e: XmlElement, binding: string, reason: string, extra = {}): void => {
    issues.push({
      code: 'UNRESOLVED_BINDING',
      message: `${file}:${e.line}:${e.column}: binding ${binding} in view ${view} not resolved (${reason})`,
      file,
      path: e.path,
      line: e.line,
      column: e.column,
      details: { view, binding, reason, ...extra },
    });
  };
  for (const c of root.children) {
    if (c.kind === 'element' && (isXsl(c, 'import') || isXsl(c, 'include'))) {
      unresolved(c, attrOf(c, null, 'href')?.value ?? '', c.localName);
    }
  }

  const occurrences = new Map<XmlElement, Occurrence[]>();
  const axOccurrences = new Map<XmlElement, Occurrence[]>();
  const callSites = new Map<string, Set<XmlElement>>();
  const walked = new Set<XmlElement>();
  const ctrlContexts = new Map<string, Ctx[]>();
  const add = (m: Map<XmlElement, Occurrence[]>, e: XmlElement, o: Occurrence) =>
    m.set(e, [...(m.get(e) ?? []), o]);

  const move = (from: Where, select: string | undefined, at: XmlElement, current: Where): Where => {
    if (select === undefined) return { reason: 'noSelect' };
    if ('reason' in from) return from;
    const r = resolveExpression(
      select,
      from.ctx,
      elementScope(at),
      env,
      'ctx' in current ? current.ctx : from.ctx,
    );
    if (r.wholeCtx !== undefined) return { ctx: r.wholeCtx };
    return { reason: r.unresolved[0]?.reason ?? 'notOnePath' };
  };
  const repeatPoint = (chain: readonly XmlElement[]): boolean => {
    for (let i = chain.length - 2; i >= 0; i--) {
      const a = chain[i]!;
      if (CELLS.some((n) => isHtml(a, n))) return false;
      if (TABLE_PARTS.some((n) => isHtml(a, n))) return true;
    }
    return false;
  };

  const walkChildren = (e: XmlElement, o: Occurrence) => {
    for (const c of e.children) if (c.kind === 'element') visit(c, o);
  };
  const visit = (e: XmlElement, s: Occurrence): void => {
    const chain = [...s.chain, e];
    const o: Occurrence = { ...s, chain };
    if (isXsl(e)) {
      switch (e.localName) {
        case 'apply-templates': {
          const mode = attrOf(e, null, 'mode')?.value;
          if (mode === undefined) return;
          callSites.set(mode, (callSites.get(mode) ?? new Set()).add(e));
          if (s.modes.includes(mode)) return; // recursion: the first call already walks it
          const where = move(s.where, attrOf(e, null, 'select')?.value, e, s.current);
          const repeat = repeatPoint(chain);
          for (const tpl of moded.get(mode) ?? []) {
            walked.add(tpl);
            walkChildren(tpl, {
              where,
              current: where,
              chain: [...chain, tpl],
              repeatAt: repeat ? chain.length - 1 : s.repeatAt,
              modes: [...s.modes, mode],
            });
          }
          return;
        }
        case 'for-each': {
          const where = move(s.where, attrOf(e, null, 'select')?.value, e, s.current);
          const repeat = repeatPoint(chain);
          walkChildren(e, {
            ...o,
            where,
            current: where,
            repeatAt: repeat ? chain.length - 1 : s.repeatAt,
          });
          return;
        }
        case 'if':
        case 'choose':
        case 'when':
        case 'otherwise':
          walkChildren(e, o);
          return;
        default:
          // Not understood (call-template, element, variable content, …): anything bound below
          // is kept, unresolved.
          walkChildren(e, { ...o, where: { reason: `xsl:${e.localName}` } });
          return;
      }
    }
    if (bindingOf(e) !== undefined) add(occurrences, e, o);
    const ctrlId = staticAvt(attrOf(e, XD, 'CtrlId')?.value ?? '');
    if (ctrlId && 'ctx' in s.where) {
      const at = s.where.ctx;
      const list = ctrlContexts.get(ctrlId) ?? [];
      if (!list.some((x) => x.ds === at.ds && x.node === at.node)) list.push(at);
      ctrlContexts.set(ctrlId, list);
    }
    if (isActiveX(e)) add(axOccurrences, e, o);
    walkChildren(e, o);
  };

  const mainDoc: Ctx = { ds: 'main', node: null };
  for (const tpl of roots) {
    walked.add(tpl);
    const match = attrOf(tpl, null, 'match')!.value.trim();
    let where: Where;
    if (match === '/') where = { ctx: mainDoc };
    else if (/[|[]/.test(match)) where = { reason: 'matchPattern' };
    else where = move({ ctx: mainDoc }, match, tpl, { ctx: mainDoc });
    walkChildren(tpl, {
      where,
      current: where,
      chain: [root, tpl],
      repeatAt: -1,
      modes: [],
    });
  }
  for (const tpl of templates) {
    if (walked.has(tpl)) continue;
    const named = attrOf(tpl, null, 'mode') === undefined;
    const where = { reason: named ? 'namedTemplate' : 'modeNotCalled' };
    walkChildren(tpl, {
      where,
      current: where,
      chain: [root, tpl],
      repeatAt: -1,
      modes: [],
    });
  }

  const byOrder = (a: XmlElement, b: XmlElement) => order.get(a)! - order.get(b)!;
  const controls = [...occurrences.keys()]
    .sort(byOrder)
    .map((e) =>
      buildControl(e, occurrences.get(e)!, { file, view, env, input, ids, callSites, unresolved }),
    );
  const byElement = new Map(controls.map((c) => [c.element, c]));
  const activeX = [...axOccurrences.keys()].sort(byOrder).map((e): ActiveXControl => {
    const bound = byElement.get(e);
    const classid = attrOf(e, null, 'classid');
    const server = attrOf(e, XD, 'server');
    const serverValue = server && staticAvt(server.value);
    const classidValue = classid && staticAvt(classid.value);
    return {
      id: ids.claim(viewElementId('ax', file, e.path), locOf(file, e)),
      view,
      ...(classidValue === undefined ? {} : { classid: classidValue }),
      ...(bound === undefined ? {} : { binding: bound.control.binding }),
      ...(bound?.control.targetId === undefined ? {} : { targetId: bound.control.targetId }),
      ...(serverValue === undefined || serverValue.trim() === ''
        ? {}
        : {
            server: classifyEndpoint('xd:server', serverValue, locOf(file, server!), packageFiles),
          }),
      source: locOf(file, e),
    };
  });
  return { controls, activeX, ctrlContexts };
}

/** R4.2 (changed at task 10): the scan context node, or an ancestor of it, repeats. */
function repeatingContext(w: Where, tree: DataTree): boolean {
  if (!('ctx' in w)) return false;
  for (let id = w.ctx.node ?? undefined; id !== undefined; id = tree.parentOf.get(id)) {
    if (tree.nodeOf.get(id)?.repeating) return true;
  }
  return false;
}

const isActiveX = (e: XmlElement): boolean =>
  (isHtml(e, 'object') && attrOf(e, null, 'classid') !== undefined) ||
  (attrOf(e, null, 'class')?.value.split(/\s+/).includes('xdActiveX') ?? false);

const sameCi = (a: string | undefined, b: string) => a !== undefined && a.toLowerCase() === b;

interface ControlEnv {
  readonly file: string;
  readonly view: string;
  readonly env: ResolveEnv;
  readonly input: ViewScanInput;
  readonly ids: IdRegistry;
  readonly callSites: ReadonlyMap<string, ReadonlySet<XmlElement>>;
  readonly unresolved: (e: XmlElement, binding: string, reason: string, extra?: object) => void;
}

function buildControl(e: XmlElement, occs: readonly Occurrence[], c: ControlEnv): ScannedControl {
  const first = occs[0]!;
  const binding = bindingOf(e)!.value;
  const dynamic: string[] = [];
  const read = (ns: string | null, local: string, name: string, on: XmlElement = e) => {
    const a = attrOf(on, ns, local);
    if (a === undefined) return undefined;
    const v = staticAvt(a.value);
    if (v === undefined) {
      if (on === e && !dynamic.includes(name)) dynamic.push(name);
      return undefined;
    }
    return { value: v, at: a };
  };
  const xctname = read(XD, 'xctname', 'xd:xctname');
  const ctrlId = read(XD, 'CtrlId', 'xd:CtrlId');
  const readOnly = sameCi(xctname?.value, 'expressionbox');
  const parent = first.chain[first.chain.length - 2];
  let title = read(null, 'title', 'title');
  if ((title === undefined || title.value.trim() === '') && parent !== undefined) {
    const outer = staticAvt(attrOf(parent, XD, 'xctname')?.value ?? '');
    if (sameCi(outer, 'dtpicker')) {
      const t = read(null, 'title', 'title', parent);
      if (t !== undefined && t.value.trim() !== '') title = t;
    }
  }
  if (title !== undefined && title.value.trim() === '') title = undefined;
  const onValue = read(XD, 'onValue', 'xd:onValue');
  const id = c.ids.claim(viewElementId('ctl', c.file, e.path), locOf(c.file, e));

  // Resolve against every occurrence (call site); the target is kept when all agree.
  const refs = new Map<string, ResolvedRef>();
  const targets = new Set<string | undefined>();
  const failures: string[] = [];
  for (const o of occs) {
    if ('reason' in o.where) {
      failures.push(o.where.reason);
      targets.add(undefined);
      continue;
    }
    const r = resolveExpression(
      binding,
      o.where.ctx,
      elementScope(e),
      c.env,
      'ctx' in o.current ? o.current.ctx : o.where.ctx,
    );
    for (const ref of r.refs) refs.set(`${ref.targetId}\u0000${ref.text}`, ref);
    targets.add(r.whole);
    if (readOnly) for (const u of r.unresolved) failures.push(u.reason);
    else if (r.whole === undefined) failures.push(r.unresolved[0]?.reason ?? 'notOnePath');
  }
  const targetId = targets.size === 1 ? [...targets][0] : undefined;
  for (const reason of new Set(failures)) c.unresolved(e, binding, reason, { elementId: id });
  const shared = [...new Set(first.modes)].filter((m) => (c.callSites.get(m)?.size ?? 0) > 1);
  if (shared.length) {
    c.unresolved(e, binding, 'modeCallSites', {
      elementId: id,
      mode: shared[0]!,
      callSites: c.callSites.get(shared[0]!)!.size,
    });
  }

  const choices = choicesFrom(e, first, c, id);
  const choice = sameCi(xctname?.value, 'optionbutton')
    ? {
        label: textAround(e, first.chain).after.text,
        ...(onValue === undefined ? {} : { value: onValue.value }),
      }
    : undefined;

  const control: BoundControl = {
    id,
    ...(xctname === undefined ? {} : { xctname: xctname.value }),
    ...(ctrlId === undefined ? {} : { ctrlId: ctrlId.value }),
    binding,
    ...(targetId === undefined ? {} : { targetId }),
    readOnly,
    ...(title === undefined ? {} : { title: title.value }),
    ...(dynamic.length ? { dynamicAttrs: dynamic } : {}),
    inRepeat: repeatingContext(first.where, c.input.tree),
    ...(choice === undefined ? {} : { choice }),
    ...(choices === undefined ? {} : { choicesFrom: choices.from }),
    source: locOf(c.file, e),
  };
  return {
    control,
    view: c.view,
    file: c.file,
    element: e,
    chain: first.chain,
    repeatAt: first.repeatAt,
    ...(title === undefined ? {} : { titleAt: locOf(c.file, title.at) }),
    refs: [...refs.values()],
    choiceRefs: choices?.refs ?? [],
  };
}

/** R4.4: the first `xsl:for-each` inside the control whose select starts with GetDOM("name"). */
function choicesFrom(
  e: XmlElement,
  o: Occurrence,
  c: ControlEnv,
  id: string,
): { from: ChoicesFrom; refs: readonly ResolvedRef[] } | undefined {
  const find = (n: XmlElement): XmlElement | undefined => {
    for (const ch of n.children) {
      if (ch.kind !== 'element') continue;
      if (isXsl(ch, 'for-each')) {
        const sel = attrOf(ch, null, 'select')?.value;
        if (sel !== undefined && /^\s*xdXDocument:GetDOM\s*\(/.test(sel)) return ch;
      }
      const deeper = find(ch);
      if (deeper) return deeper;
    }
    return undefined;
  };
  const fe = find(e);
  if (fe === undefined) return undefined;
  const select = attrOf(fe, null, 'select')!.value;
  let parsed;
  try {
    parsed = parseExpression(select);
  } catch (err) {
    if (!(err instanceof XPathLexError)) throw err;
    c.unresolved(fe, select, 'notInTree', { elementId: id, part: 'choicesFrom' });
    return undefined;
  }
  const start = parsed.paths[0]?.start;
  if (start?.kind !== 'getDom') return undefined;
  const dataSource = start.name;
  const connection = c.input.connections.find((x) => x.dataSource === dataSource && x.isQuery);
  const at = 'ctx' in o.where ? o.where.ctx : { ds: 'main', node: null };
  const r = resolveExpression(select, at, elementScope(fe), c.env);
  const outer = new Set(parsed.paths.map((p) => select.slice(p.pos, p.end)));
  for (const u of r.unresolved)
    c.unresolved(fe, select, u.reason, { elementId: id, part: 'choicesFrom' });
  const filterIds = [...new Set(r.refs.filter((x) => !outer.has(x.text)).map((x) => x.targetId))];
  return {
    from: {
      dataSource,
      ...(connection === undefined ? {} : { connectionId: connection.id }),
      select,
      filterIds,
    },
    refs: r.refs,
  };
}
