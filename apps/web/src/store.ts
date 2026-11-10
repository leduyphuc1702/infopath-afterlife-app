// Spec 09 design §5: the page's state. In memory only.
import type { SideTab } from './side/SideTabs';
import type {
  FileFailure,
  RecordSummary,
  SessionRes,
  TemplateSummary,
  WireError,
} from './worker/protocol';

export interface Problem {
  readonly fileName: string;
  readonly error: WireError;
}

export interface Selection {
  readonly fieldId?: string;
  /** The control pointed at, when there is one. */
  readonly controlId?: string;
  /** Where the selection came from: the tree scrolls the paper to it, the paper does not. */
  readonly from?: 'tree' | 'paper';
}

export interface State {
  readonly templates: readonly TemplateSummary[];
  readonly records: readonly RecordSummary[];
  /** Worker failures, then those found before reading (size, count). */
  readonly failures: readonly FileFailure[];
  readonly problems: readonly Problem[];
  readonly ignored: readonly string[];
  readonly openId?: string;
  readonly view?: string;
  /** 0 is the empty form; n is the n-th matched record. */
  readonly recordIndex: number;
  readonly xray: boolean;
  readonly selection: Selection;
  /** The side panel's tab, and the connection entry opened from the details card (R6.1). */
  readonly tab: SideTab;
  readonly connectionId?: string;
  readonly busy?: string;
}

export const initialState: State = {
  templates: [],
  records: [],
  failures: [],
  problems: [],
  ignored: [],
  recordIndex: 0,
  xray: false,
  selection: {},
  tab: 'fields',
};

export type Action =
  | { readonly type: 'busy'; readonly what?: string }
  | { readonly type: 'session'; readonly session: SessionRes; readonly open?: string }
  | {
      readonly type: 'input';
      readonly ignored: readonly string[];
      readonly problems: readonly Problem[];
    }
  | { readonly type: 'open'; readonly templateId: string }
  | { readonly type: 'view'; readonly view: string }
  | { readonly type: 'record'; readonly index: number }
  | { readonly type: 'xray'; readonly on: boolean }
  | { readonly type: 'select'; readonly selection: Selection }
  | { readonly type: 'tab'; readonly tab: SideTab; readonly connectionId?: string };

const defaultView = (t: TemplateSummary) =>
  (t.ir.views.find((v) => v.isDefault) ?? t.ir.views[0])?.name;

const withoutConnection = (s: State): State => {
  const rest = { ...s };
  delete (rest as { connectionId?: string }).connectionId;
  return rest;
};

function openState(s: State, t: TemplateSummary | undefined): State {
  if (!t) return s;
  const view = defaultView(t);
  return {
    ...withoutConnection(s),
    openId: t.templateId,
    ...(view !== undefined ? { view } : {}),
    recordIndex: 0,
    selection: {},
  };
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'busy': {
      if (a.what !== undefined) return { ...s, busy: a.what };
      const rest = { ...s };
      delete (rest as { busy?: string }).busy;
      return rest;
    }
    case 'session': {
      const next: State = {
        ...s,
        templates: a.session.templates,
        records: a.session.records,
        failures: a.session.failures,
      };
      const wanted = a.session.templates.find((t) => t.templateId === a.open);
      const still = a.session.templates.find((t) => t.templateId === s.openId);
      if (wanted) return openState(next, wanted);
      if (still) return next;
      return openState(next, a.session.templates[0]);
    }
    case 'input':
      return {
        ...s,
        ignored: [...s.ignored, ...a.ignored],
        problems: [...s.problems, ...a.problems],
      };
    case 'open':
      return openState(
        s,
        s.templates.find((t) => t.templateId === a.templateId),
      );
    case 'view':
      return { ...s, view: a.view };
    case 'record':
      return { ...s, recordIndex: a.index };
    case 'xray':
      return { ...s, xray: a.on, selection: a.on ? s.selection : {} };
    case 'select':
      return { ...s, selection: a.selection };
    case 'tab':
      return {
        ...withoutConnection(s),
        tab: a.tab,
        ...(a.connectionId !== undefined && { connectionId: a.connectionId }),
      };
  }
}

export const openTemplate = (s: State) => s.templates.find((t) => t.templateId === s.openId);

/** The records matched to a template, in file name order (R3.2). */
export const recordsOf = (s: State, templateId: string | undefined) =>
  s.records.filter((r) => r.match.kind !== 'unmatched' && r.match.templateId === templateId);

export const unmatched = (s: State) => s.records.filter((r) => r.match.kind === 'unmatched');
