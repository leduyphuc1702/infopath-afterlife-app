// Spec 09 design §5: the page's state. In memory only.
import type { TriageResult } from '@afterlife/core';
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
  /** Spec 12 design §6: Triage, one form's certificate, or the form itself. */
  readonly screen: Screen;
  readonly certificateId?: string;
  readonly triage?: TriageResult;
  readonly busy?: string;
  /** Spec 13 B3: a note on the last files opened, e.g. one already open. */
  readonly notice?: string;
}

/** Spec 15: `documentation` is the open template's dossier. */
export type Screen = 'form' | 'triage' | 'certificate' | 'documentation';

/** Spec 13 B2: what one history entry holds. */
export interface Place {
  readonly screen: Screen;
  readonly openId?: string;
  readonly certificateId?: string;
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
  screen: 'form',
};

export type Action =
  | { readonly type: 'busy'; readonly what?: string }
  | {
      readonly type: 'session';
      readonly session: SessionRes;
      readonly open?: string;
      /** Spec 12 R4.1: files that leave two or more templates open show Triage. */
      readonly screen?: Screen;
      readonly notice?: string;
    }
  | {
      readonly type: 'input';
      readonly ignored: readonly string[];
      readonly problems: readonly Problem[];
    }
  | { readonly type: 'open'; readonly templateId: string }
  | { readonly type: 'screen'; readonly screen: Screen; readonly templateId?: string }
  /** Spec 09 R12.4: a note for the status line, e.g. what an export wrote. */
  | { readonly type: 'notice'; readonly notice: string | undefined }
  /** Spec 13 B2: Back or Forward reached a history entry; show its place. */
  | { readonly type: 'restore'; readonly place: Place }
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

const withoutNotice = (s: State): State => {
  const rest = { ...s };
  delete (rest as { notice?: string }).notice;
  return rest;
};

/**
 * Spec 13 B4: when records arrive for the open template (with it, or later), the pager shows the
 * first of them; the empty form stays one Previous away. No new record: the place is kept.
 */
function showArrived(before: State, after: State): State {
  const had = new Set(recordsOf(before, after.openId).map((r) => r.recordId));
  const i = recordsOf(after, after.openId).findIndex((r) => !had.has(r.recordId));
  return i < 0 ? after : { ...after, recordIndex: i + 1 };
}

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
        ...withoutNotice(s),
        templates: a.session.templates,
        records: a.session.records,
        failures: a.session.failures,
        triage: a.session.triage,
        ...(a.screen !== undefined && { screen: a.screen }),
        ...(a.notice !== undefined && { notice: a.notice }),
      };
      const wanted = a.session.templates.find((t) => t.templateId === a.open);
      const still = a.session.templates.find((t) => t.templateId === s.openId);
      const opened = wanted
        ? openState(next, wanted)
        : still
          ? next
          : openState(next, a.session.templates[0]);
      return showArrived(s, opened);
    }
    case 'restore': {
      const { place } = a;
      const t = s.templates.find((x) => x.templateId === place.openId);
      const base =
        (place.screen === 'form' || place.screen === 'documentation') &&
        t &&
        t.templateId !== s.openId
          ? openState(s, t)
          : s;
      return {
        ...base,
        screen: place.screen,
        ...(place.certificateId !== undefined && { certificateId: place.certificateId }),
      };
    }
    case 'screen': {
      const t =
        a.templateId === undefined
          ? undefined
          : s.templates.find((x) => x.templateId === a.templateId);
      // A certificate keeps the open form; "Open form" opens the certificate's template.
      if ((a.screen === 'form' || a.screen === 'documentation') && t && t.templateId !== s.openId)
        return { ...openState(s, t), screen: a.screen };
      return {
        ...s,
        screen: a.screen,
        ...(t && a.screen === 'certificate' && { certificateId: t.templateId }),
      };
    }
    case 'input':
      return {
        ...withoutNotice(s),
        ignored: [...s.ignored, ...a.ignored],
        problems: [...s.problems, ...a.problems],
      };
    case 'open':
      return openState(
        s,
        s.templates.find((t) => t.templateId === a.templateId),
      );
    case 'notice':
      return a.notice === undefined ? withoutNotice(s) : { ...s, notice: a.notice };
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
