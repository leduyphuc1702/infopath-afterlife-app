import type { TraceEntry, TriageRow } from '@afterlife/core';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { fromDataTransfer, sortInput } from './files/collect';
import { Attention } from './paper/Attention';
import { ExportRecords, save, type RecordFormat } from './paper/ExportRecords';
import { DrawError } from './paper/DrawError';
import { Paper } from './paper/Paper';
import { RuleDialog } from './paper/RuleDialog';
import { PaperToolbar, viewCaption } from './paper/PaperToolbar';
import { ErrorBanner } from './shell/ErrorBanner';
import { Header } from './shell/Header';
import { Landing } from './shell/Landing';
import { taskOf, type Task } from './shell/tasks';
import { Notices } from './shell/Notices';
import { alreadyOpen, exportedNotice, notOpened, screenTitle } from './shell/announce';
import { keyOf, placeIn, placeOf, visit } from './shell/history';
import { loadPaperFonts, onDemandFacesFailed } from './shell/fonts';
import { sampleName } from './shell/sample-names';
import { cardFor, cardForControl } from './side/card';
import { DataConnections } from './side/DataConnections';
import { DetailsCard } from './side/DetailsCard';
import { FieldTree } from './side/FieldTree';
import { RuleTrace } from './side/RuleTrace';
import { SideTabs } from './side/SideTabs';
import { Unmatched } from './side/Unmatched';
import { Certificate } from './triage/Certificate';
import { ExportMenu } from './triage/ExportMenu';
import { PrintPlan } from './triage/PrintPlan';
import { TriageTable } from './triage/TriageTable';
import { initialState, openTemplate, recordsOf, reducer, unmatched, type Problem } from './store';
import { localNow, WorkerClient } from './worker/client';
import type {
  FailedRes,
  FillCommand,
  FilledRes,
  Progress,
  RenderedRes,
  DocumentationRes,
  RecordListRes,
  ResBody,
} from './worker/protocol';
import { DISCARD, useConfirm, type Question } from './shell/Confirm';
import { Documentation } from './docs/Documentation';
import { keepTrace, stepEntry } from './side/trace-keep';
import './docs/docs.css';
import './records/records.css';
import { Records, type ListPlace } from './records/Records';
import { ArchiveMenu } from './paper/ArchiveMenu';
import { PRINT_CSS, READ_CSS, uncommitted } from './paper/fill';

/** The latest render answer; the previous paper stays up while the next one is drawn. */
/** `templateId`: the template it was made for; another template's render is never shown. */
type Render = (RenderedRes | FailedRes) & { readonly first?: boolean; readonly templateId: string };

/** Spec 04: the fill session the page knows of: its template, record and latest answer. */
interface Fill {
  readonly templateId: string;
  readonly recordIndex: number;
  readonly view: string;
  readonly res?: FilledRes;
  /** One status-line sentence after the fill sentence (worked-out fields, a download). */
  readonly message?: string;
  /** Spec 04 task 11: the Rule Trace so far, the last 500 entries. */
  readonly trace: readonly TraceEntry[];
}

/**
 * Spec 14 B5: a button whose rules were skipped in part says so in the status line, since the
 * Rule Trace may be closed.
 */
function pressMessage(c: FillCommand, r: ResBody): string | undefined {
  if (c.kind !== 'press' || r.type !== 'filled' || r.dialogs.length > 0) return undefined;
  const skipped = r.trace.filter((e) => e.kind === 'skipped');
  if (skipped.length === 0) return undefined;
  const button = document
    .querySelector('[data-afl-paper]')
    ?.shadowRoot?.querySelector<HTMLInputElement>(`[data-afl-button="${CSS.escape(c.ctrlId)}"]`);
  const name = button?.value ? `“${button.value}”` : 'This button';
  const query = skipped.some(
    (e) => e.note === 'Query connections are not available in the viewer.',
  );
  return query
    ? `${name} ran only in part: query connections are not available in the viewer. Rule Trace lists what was skipped.`
    : `${name} ran only in part: some of its actions are not available in the viewer. Rule Trace lists what was skipped.`;
}

/** Spec 04 task 12: shortcut names as the person's keyboard shows them. */
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl';

export function App() {
  const client = useMemo(() => new WorkerClient(), []);
  const [now] = useState(localNow);
  const [s, dispatch] = useReducer(reducer, initialState);
  const [latestRender, setRender] = useState<Render>();
  const known = useRef(new Set<string>());
  const seenRecords = useRef(new Set<string>());
  const latest = useRef(0);
  const faded = useRef(new Set<string>());

  useEffect(() => () => client.terminate(), [client]);

  // Design D7: after `load`, the Worker imports the samples chunk and the four Latin faces load;
  // then `<html data-ready>` says the page works offline (R8.1).
  useEffect(() => {
    let gone = false;
    const warm = () =>
      void Promise.allSettled([client.warm(), loadPaperFonts()]).then(() => {
        if (!gone) document.documentElement.dataset.ready = '';
      });
    if (document.readyState === 'complete') warm();
    else window.addEventListener('load', warm, { once: true });
    return () => {
      gone = true;
      window.removeEventListener('load', warm);
    };
  }, [client]);

  const [fontNote, setFontNote] = useState(false);
  const fontTicket = useRef(0);
  const onPaperText = useCallback((text: string) => {
    const ticket = ++fontTicket.current;
    setFontNote(false);
    void onDemandFacesFailed(text).then((failed) => {
      if (ticket === fontTicket.current) setFontNote(failed);
    });
  }, []);

  // Spec 13 B10: one polite announcement per drop. The same words twice are said twice: the
  // region is emptied first.
  const [announcement, setAnnouncement] = useState('');
  const say = useCallback((text: string) => {
    setAnnouncement('');
    if (text !== '') requestAnimationFrame(() => setAnnouncement(text));
  }, []);

  /** Applies a Worker answer to an open request; opens the first template it added. */
  const [reading, setReading] = useState<string>();
  const progress: Progress = useCallback(
    (p) => setReading(`Reading ${p.index} of ${p.total}: ${p.fileName}`),
    [],
  );

  /** `triage`: files were opened by the user, so two or more templates show Triage (R4.1). */
  // Spec 26 M2: `bundled`: a sample the app ships; loaded again, it just opens, with no notice.
  const applySession = useCallback(
    (res: ResBody, what: string, triage = false, bundled = false) => {
      dispatch({ type: 'busy' });
      setReading(undefined);
      if (res.type !== 'session') {
        if (res.type === 'failed')
          dispatch({
            type: 'input',
            ignored: [],
            problems: [{ fileName: what, error: res.error }],
          });
        return;
      }
      const added = res.templates.find((t) => !known.current.has(t.templateId));
      for (const t of res.templates) known.current.add(t.templateId);
      // Spec 13 B3: files already open add nothing; the template they are is shown again.
      const again = [
        ...new Set(
          res.duplicates.flatMap((d) => (d.templateId === undefined ? [] : [d.templateId])),
        ),
      ];
      const open = added?.templateId ?? (again.length === 1 ? again[0] : undefined);
      const screen =
        triage && (added ? res.templates.length >= 2 : again.length >= 2)
          ? 'triage'
          : open !== undefined
            ? 'form'
            : undefined;
      const notice = bundled ? undefined : alreadyOpen(res.duplicates.map((d) => d.fileName));
      dispatch({
        type: 'session',
        session: res,
        ...(open !== undefined && { open }),
        ...(screen && { screen }),
        ...(notice !== undefined && { notice }),
      });
      return res;
    },
    [],
  );

  const openFiles = useCallback(
    async (files: File[]) => {
      const c = sortInput(files);
      const problems: Problem[] = [
        ...c.rejected,
        ...(c.tooMany ? [{ fileName: '', error: c.tooMany }] : []),
      ];
      dispatch({ type: 'input', ignored: c.ignored, problems });
      if (c.files.length === 0) {
        say(notOpened(c.ignored, []));
        return;
      }
      dispatch({
        type: 'busy',
        what: c.files.length === 1 ? c.files[0]!.name : `${c.files.length} files`,
      });
      const [res] = await Promise.all([client.open(c.files, progress), loadPaperFonts()]);
      applySession(res, 'the files', true);
      // Spec 09 R12.8: entries of a .zip that are not opened join the list.
      const inZip = res.type === 'session' ? res.ignored : [];
      if (inZip.length > 0) dispatch({ type: 'input', ignored: inZip, problems: [] });
      // Spec 13 B10: this drop's files not opened, and the records it added that no open template
      // made (inside a .zip too).
      const orphans =
        res.type === 'session'
          ? res.records.filter(
              (r) => r.match.kind === 'unmatched' && !seenRecords.current.has(r.recordId),
            )
          : [];
      if (res.type === 'session') for (const r of res.records) seenRecords.current.add(r.recordId);
      say(
        notOpened(
          [...c.ignored, ...inZip],
          orphans.map((r) => r.fileName),
        ),
      );
    },
    [client, applySession, progress, say],
  );

  const openSample = useCallback(
    async (id: string) => {
      dispatch({ type: 'busy', what: sampleName(id) });
      const [res] = await Promise.all([client.openSample(id, progress), loadPaperFonts()]);
      applySession(res, sampleName(id), false, true);
    },
    [client, applySession, progress],
  );

  // Spec 12 R4.5: every bundled sample, straight to Triage.
  const openAllSamples = useCallback(async () => {
    dispatch({ type: 'busy', what: 'all samples' });
    const [res] = await Promise.all([client.openAllSamples(progress), loadPaperFonts()]);
    applySession(res, 'the samples', true, true);
  }, [client, applySession, progress]);

  // Spec 09 R12.1–R12.4: the Worker exports, reporting each record; the page saves the bytes.
  const [exporting, setExporting] = useState(false);
  const exportRecords = useCallback(
    async (templateId: string, format: RecordFormat) => {
      setExporting(true);
      const res = await client.exportRecords(templateId, format, (p) =>
        setReading(`Exporting record ${p.index} of ${p.total}: ${p.fileName}`),
      );
      setExporting(false);
      setReading(undefined);
      if (res.type === 'exported') {
        save(
          res.bytes,
          res.fileName,
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/zip',
        );
        dispatch({ type: 'notice', notice: exportedNotice(res, format) });
        // Spec 22 F6: the menu closed with focus inside it; focus goes back to its summary.
        requestAnimationFrame(() => {
          const a = document.activeElement;
          if (!a || a === document.body)
            document.querySelector<HTMLElement>('.afl-export-records summary')?.focus();
        });
      } else if (res.type === 'failed')
        dispatch({
          type: 'input',
          ignored: [],
          problems: [{ fileName: 'the export', error: res.error }],
        });
    },
    [client],
  );

  // Spec 18: records as web pages, made in the Worker; Cancel stops it between records (R8).
  const [archiving, setArchiving] = useState(false);
  const archiveOpener = useRef<HTMLElement | null>(null);
  const archive = useCallback(
    async (
      templateId: string,
      views: readonly string[],
      opener: HTMLElement | null,
      recordIds?: readonly string[],
    ) => {
      archiveOpener.current = opener;
      setExporting(true);
      setArchiving(true);
      const res = await client.archive(
        {
          templateId,
          views,
          ...(recordIds && { recordIds }),
          now: localNow(),
          css: READ_CSS + PRINT_CSS,
        },
        (p) => setReading(`Archiving record ${p.index} of ${p.total}: ${p.fileName}`),
      );
      setExporting(false);
      setArchiving(false);
      setReading(undefined);
      // Spec 19 F2, F3: the menu closed and Cancel went; focus goes back to what opened it.
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (!a || a === document.body) archiveOpener.current?.focus();
      });
      const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
      if (res.type === 'archived') {
        save(res.bytes, res.fileName, 'application/zip');
        dispatch({
          type: 'notice',
          notice: [
            `Archived ${n(res.records, 'record', 'records')} as ${n(res.pages, 'web page', 'web pages')} in ${res.fileName}.`,
            res.files > 0 &&
              `${n(res.files, 'attachment or picture is', 'attachments and pictures are')} in its attachments folder.`,
            res.unread > 0 &&
              `${n(res.unread, 'record', 'records')} could not be read or drawn; ${res.unread === 1 ? 'its page says' : 'their pages say'} why.`,
          ]
            .filter(Boolean)
            .join(' '),
        });
      } else if (res.type === 'cancelled')
        dispatch({ type: 'notice', notice: 'Archiving stopped. Nothing was saved.' });
      else if (res.type === 'failed')
        dispatch({
          type: 'input',
          ignored: [],
          problems: [{ fileName: 'the archive', error: res.error }],
        });
    },
    [client],
  );

  const csv = useCallback(async () => {
    const r = await client.csv();
    return r.type === 'csv' ? r.text : undefined;
  }, [client]);

  // R1.1: drop anywhere on the page.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) void fromDataTransfer(e.dataTransfer).then(openFiles);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [openFiles]);

  const template = openTemplate(s);
  const records = useMemo(() => recordsOf(s, s.openId), [s]);
  const record = s.recordIndex === 0 ? undefined : records[s.recordIndex - 1];
  const view = template?.ir.views.find((v) => v.name === s.view);
  const failures = useMemo(
    () => [...s.failures.map((f) => ({ fileName: f.fileName, error: f.error })), ...s.problems],
    [s.failures, s.problems],
  );

  // Spec 04: one fill session, for one template's empty form or one record. Leaving the form
  // screen (Back, Forward, Triage) keeps it: it comes back with the same template and record.
  const [fill, setFill] = useState<Fill>();
  const [confirm, ask] = useConfirm();
  const fillOn =
    fill !== undefined &&
    template !== undefined &&
    s.screen === 'form' &&
    fill.templateId === template.templateId &&
    fill.recordIndex === s.recordIndex;
  const fillUnavailable =
    record && record.match.kind !== 'exact'
      ? 'Fill works on the empty form and on records made with this version of the form.'
      : undefined;
  const viewRef = useRef(view?.name);
  viewRef.current = view?.name;

  /** Spec 04 task 10: messages from rules (and "Not available in the viewer") to show. */
  const [messages, setMessages] = useState<readonly string[]>([]);
  /** Spec 04 task 11: the field the hovered or focused Rule Trace entry is about. */
  const [traced, setTraced] = useState<string>();
  /** Spec 14 B5: what the last button press could not do, until the next command. */
  const [pressNote, setPressNote] = useState<string>();
  // Spec 24 D1: a line the paper asks for (a rich text box that will lose its formatting).
  useEffect(() => {
    const on = (e: Event) => setPressNote((e as CustomEvent<string>).detail);
    document.addEventListener('afl-note', on);
    return () => document.removeEventListener('afl-note', on);
  }, []);
  const fillAnswer = useCallback((r: ResBody, message?: string, step?: 'undo' | 'redo') => {
    if (r.type === 'filled') {
      setFill(
        (f) =>
          f && {
            ...f,
            res: r,
            view: viewRef.current ?? f.view,
            trace: keepTrace(f.trace, [
              ...r.trace,
              ...(step && f.res ? [stepEntry(step, f.res.values, r.values, r.trace)] : []),
            ]),
            ...(message !== undefined && { message }),
          },
      );
      if (r.dialogs.length + r.notices.length > 0) setMessages([...r.dialogs, ...r.notices]);
      if (r.view !== undefined) dispatch({ type: 'view', view: r.view });
    } else if (r.type === 'failed') {
      if (r.error.code === 'FILL_STATE') setFill(undefined);
      dispatch({
        type: 'input',
        ignored: [],
        problems: [{ fileName: 'the change', error: r.error }],
      });
    }
  }, []);
  // Spec 23 B2: edits sent and not yet answered, and the latest of them.
  const sent = useRef(0);
  const inFlight = useRef<Promise<ResBody | undefined>>(Promise.resolve(undefined));
  const fillCommand = useCallback(
    (c: FillCommand) => {
      const v = viewRef.current;
      if (v === undefined) return;
      sent.current++;
      const p = client.fill(c, v, localNow()).then((r) => {
        setPressNote(pressMessage(c, r));
        // Spec 16 N2: a new command ends the last export's note.
        dispatch({ type: 'notice', notice: undefined });
        fillAnswer(r, undefined, c.kind === 'undo' || c.kind === 'redo' ? c.kind : undefined);
        return r;
      });
      inFlight.current = p;
      void p.finally(() => sent.current--);
    },
    [client, fillAnswer],
  );
  /** Leaves Fill; asks first when there are changes that were not downloaded (R6.4). */
  const leaveFill = useCallback(async (): Promise<boolean> => {
    if (!fill) return true;
    // Spec 23 B2: typing not yet left is committed as leaving the field commits it, and an edit
    // still on its way to the Worker counts: its answer says whether there are changes.
    const open = uncommitted();
    // Spec 24 X5: the commit draws the paper again, so the field is found again by its marks.
    const where = open && { ctrl: open.dataset.aflCtrl ?? '', path: open.dataset.aflPath ?? '' };
    open?.blur();
    let dirty = fill.res?.dirty;
    if (sent.current > 0) {
      const r = await inFlight.current.catch(() => undefined);
      if (r?.type === 'filled') dirty = r.dirty;
    }
    // Spec 14 B10: the changes may be on another form or record than the one shown; say where.
    if (dirty) {
      let q: Question = DISCARD;
      if (!fillOn) {
        const name = s.templates.find((t) => t.templateId === fill.templateId)?.ir.meta.name;
        const record =
          fill.recordIndex === 0
            ? 'the empty form'
            : (recordsOf(s, fill.templateId)[fill.recordIndex - 1]?.fileName ?? 'a record');
        q = {
          ...DISCARD,
          body: `You changed ${name ?? 'another form'} (${record}) and haven't downloaded the XML. Nothing is saved in the viewer, so the changes will be lost.`,
        };
      }
      if (!(await ask(q))) {
        if (where)
          document
            .querySelector('[data-afl-paper]')
            ?.shadowRoot?.querySelector<HTMLElement>(
              `[data-afl-ctrl="${CSS.escape(where.ctrl)}"][data-afl-path="${CSS.escape(where.path)}"]`,
            )
            ?.focus();
        return false;
      }
    }
    setFill(undefined);
    void client.fillClose();
    return true;
  }, [fill, fillOn, s, ask, client]);
  const toggleFill = useCallback(async () => {
    if (!template || !view) return;
    if (fillOn) return void leaveFill();
    if (!(await leaveFill())) return;
    const r = await client.fillOpen(template.templateId, record?.recordId, view.name, localNow());
    if (r.type !== 'filled') return fillAnswer(r);
    setFill({
      templateId: template.templateId,
      recordIndex: s.recordIndex,
      view: view.name,
      res: r,
      // The marks opening draws are on the paper already; the trace starts with what ran.
      trace: keepTrace(
        [],
        r.trace.filter((e) => e.kind !== 'validation'),
      ),
      ...((r.workedOut > 0 || r.corrected > 0) && {
        message: [
          r.workedOut > 0 &&
            `${r.workedOut} calculated ${r.workedOut === 1 ? 'field was' : 'fields were'} empty in this record and ${r.workedOut === 1 ? 'has' : 'have'} been worked out.`,
          // Spec 16 K13: say when the form's formulas disagree with what the record stored.
          r.corrected > 0 &&
            `${r.corrected} ${r.corrected === 1 ? 'value stored in this record differs from the form’s own formula' : 'values stored in this record differ from the form’s own formulas'}; the form’s ${r.corrected === 1 ? 'value is' : 'values are'} shown.`,
        ]
          .filter(Boolean)
          .join(' '),
      }),
    });
  }, [template, view, record, s.recordIndex, fillOn, leaveFill, client, fillAnswer]);
  // Spec 21: a task opens its sample, then puts the screen in the task's state (once the
  // sample's template is open), then shows one line on what to try first.
  const [pending, setPending] = useState<Task>();
  const landed = useRef<string>(undefined);
  const taskRun = useRef(false);
  const [hint, setHint] = useState<string>();
  const [keepOpen, setKeepOpen] = useState(false);
  const runTask = useCallback(
    async (task: Task) => {
      setHint(undefined);
      setKeepOpen(false);
      // Spec 23 B1: every screen the task passes through takes the task's own entry, whether the
      // task starts from its link or comes back on Forward; the address keeps its hash.
      taskRun.current = true;
      landed.current =
        task.id === 'find'
          ? 'records'
          : task.id === 'document'
            ? 'documentation'
            : task.id === 'triage'
              ? 'triage'
              : undefined;
      if (task.sample === 'all') await openAllSamples();
      else await openSample(task.sample);
      // A sample opened before says "already open"; the task's own line says enough.
      dispatch({ type: 'notice', notice: undefined });
      setPending(task);
    },
    [openSample, openAllSamples],
  );
  useEffect(() => {
    const t = pending;
    if (!t) return;
    if (t.sample === 'all' ? s.screen !== 'triage' : !template || !view) return;
    // Spec 23 B1: the form's tasks open on record 1 also when the sample was open already.
    if (['read', 'fill', 'rules', 'keep'].includes(t.id) && s.recordIndex !== 1)
      return void dispatch({ type: 'record', index: 1 });
    setPending(undefined);
    void (async () => {
      if (t.id === 'rules') dispatch({ type: 'xray', on: true });
      if (t.id === 'fill') {
        await toggleFill();
        dispatch({ type: 'tab', tab: 'trace' });
      }
      if (t.id === 'find') dispatch({ type: 'screen', screen: 'records' });
      if (t.id === 'document') dispatch({ type: 'screen', screen: 'documentation' });
      if (t.id === 'keep') setKeepOpen(true);
      setHint(t.hint);
      // R3: said once, after the screen's own focus move.
      setTimeout(() => say(t.hint), 300);
    })();
  }, [pending, template, view, s.screen, s.recordIndex, toggleFill, say]);
  // R3: the line goes when the person does something else on the page.
  useEffect(() => {
    if (hint === undefined) return;
    const act = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.afl-hint')) return;
      setHint(undefined);
      setKeepOpen(false);
    };
    // Spec 22 F1: after the click, not on pointerdown: removing the line moves the screen up, and
    // a click whose press and release land on different things does nothing.
    const kinds = ['click', 'input', 'change'] as const;
    for (const k of kinds) document.addEventListener(k, act, true);
    return () => {
      for (const k of kinds) document.removeEventListener(k, act, true);
    };
  }, [hint]);
  // R4, R5: a task's address. Back from it comes to the landing page, which is the entry below.
  const startTask = useCallback(
    (task: Task) => {
      history.pushState(null, '', `#${task.id}`);
      void runTask(task);
    },
    [runTask],
  );
  const homeRef = useRef(true);
  homeRef.current = !template;
  const homeFocus = useRef(false);
  useEffect(() => {
    if (template || !homeFocus.current) return;
    homeFocus.current = false;
    document.getElementById('afl-tasks-h')?.focus();
  }, [template]);
  const taskRef = useRef(runTask);
  taskRef.current = runTask;
  const leaveRef = useRef(leaveFill);
  leaveRef.current = leaveFill;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (location.hash === '') return;
    const t = taskOf(location.hash);
    // R6: an address the app does not know opens the landing page and says nothing.
    history.replaceState(null, '', location.pathname + location.search);
    if (t) startTask(t);
  }, [startTask]);

  const downloadXml = useCallback(async () => {
    const r = await client.fillDownload();
    if (r.type !== 'filledXml') return fillAnswer(r);
    save(r.bytes, r.fileName, 'application/xml');
    const left =
      r.invalid > 0
        ? ` ${r.invalid} ${r.invalid === 1 ? 'field still needs' : 'fields still need'} attention.`
        : '';
    setFill(
      (f) =>
        f && {
          ...f,
          ...(f.res && { res: { ...f.res, dirty: false } }),
          message: `Downloaded ${r.fileName}.${left}`,
        },
    );
  }, [client, fillAnswer]);
  // Another view while filling: the session renders it.
  useEffect(() => {
    if (fillOn && view && fill.view !== view.name) fillCommand({ kind: 'render' });
  }, [fillOn, view, fill?.view, fillCommand]);
  // Closing the tab with unsaved changes asks the browser's own question.
  const dirty = fill?.res?.dirty === true;
  // R10.1: Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z anywhere on the form screen but in a text entry
  // outside the paper (the paper handles its own keys).
  useEffect(() => {
    if (!fillOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      e.preventDefault();
      fillCommand({ kind: e.shiftKey ? 'redo' : 'undo' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fillOn, fillCommand]);
  useEffect(() => {
    // Spec 25 L1: typing still in its field counts as a change too; it is asked about when the
    // page is left, as it is for Back, Next and the Fill switch (spec 23 B2).
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || (fillOn && uncommitted())) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, fillOn]);

  useEffect(() => {
    if (!template || !view || s.screen !== 'form' || fillOn) return;
    const ticket = ++latest.current;
    void client.render(template.templateId, view.name, record?.recordId, now).then((r) => {
      if (ticket !== latest.current) return; // a newer request is on its way
      if (r.type !== 'rendered' && r.type !== 'failed') return;
      // R9.3: the first successful render of each template fades in.
      const first = r.type === 'rendered' && !faded.current.has(template.templateId);
      if (first) faded.current.add(template.templateId);
      setRender({ ...r, first, templateId: template.templateId });
    });
  }, [client, now, template, view, record, s.screen, fillOn]);

  // The previous paper stays up while the next render of the same template is drawn; a render
  // of another template (opened from Triage, or a stale failure) is not shown under this one.
  const render = latestRender?.templateId === template?.templateId ? latestRender : undefined;

  // X-ray (R5): marks[i] is the i-th `[data-afl-ctrl]` element (design §5).
  const rendered = fillOn && fill.res ? fill.res : render?.type === 'rendered' ? render : undefined;
  const targetOf = useMemo(
    () =>
      new Map(template?.ir.views.flatMap((v) => v.controls.map((c) => [c.id, c.targetId])) ?? []),
    [template],
  );
  const fieldOfMark = useCallback(
    (i: number) => {
      const m = rendered?.marks[i];
      return m && (m.fieldId ?? targetOf.get(m.controlId));
    },
    [rendered, targetOf],
  );
  const [hover, setHover] = useState<number>();
  const hoverRef = useRef<number>(undefined);
  const outlined = useMemo(() => {
    if (!rendered) return [];
    const id = s.selection.fieldId;
    const out =
      id === undefined ? [] : rendered.marks.flatMap((_m, i) => (fieldOfMark(i) === id ? [i] : []));
    return hover !== undefined && !out.includes(hover) ? [...out, hover] : out;
  }, [rendered, s.selection.fieldId, hover, fieldOfMark]);
  const reveal = s.selection.from === 'tree' ? outlined[0] : undefined;
  const onPoint = useCallback(
    (i: number | undefined) => {
      if (i === hoverRef.current) return;
      hoverRef.current = i;
      setHover(i);
      if (i === undefined) return;
      const m = rendered?.marks[i];
      if (!m) return;
      const fieldId = fieldOfMark(i);
      dispatch({
        type: 'select',
        selection: {
          controlId: m.controlId,
          from: 'paper',
          ...(fieldId !== undefined && { fieldId }),
        },
      });
    },
    [rendered, fieldOfMark],
  );
  const selectField = useCallback(
    (fieldId: string) => dispatch({ type: 'select', selection: { fieldId, from: 'tree' } }),
    [],
  );
  const card =
    template &&
    (s.selection.fieldId !== undefined
      ? cardFor(template.ir, s.selection.fieldId)
      : s.selection.controlId !== undefined
        ? cardForControl(template.ir, s.selection.controlId)
        : undefined);

  // Spec 17: the open template's records list, read in the Worker when its screen is shown, and
  // the place in it that Back restores (R9).
  const [list, setList] = useState<RecordListRes>();
  const listPlace = useRef<{ templateId?: string; place: ListPlace }>({
    place: { query: '', scroll: 0 },
  });
  const listId = s.screen === 'records' ? template?.templateId : undefined;
  const listCount = listId === undefined ? 0 : recordsOf(s, listId).length;
  useEffect(() => {
    if (listId === undefined || (list?.templateId === listId && list.rows.length === listCount))
      return;
    const t0 = performance.now();
    void client.recordList(listId, now).then((res) => {
      if (res.type === 'recordList') {
        setList(res);
        // R11: measured by the e2e tests (Worker time, then the whole round trip).
        console.debug(
          `R11 list: worker ${res.ms} ms, answer ${Math.round(performance.now() - t0)} ms`,
        );
      } else if (res.type === 'failed')
        dispatch({
          type: 'input',
          ignored: [],
          problems: [{ fileName: 'the records list', error: res.error }],
        });
    });
  }, [listId, listCount, list, client, now]);
  if (listId !== undefined && listPlace.current.templateId !== listId)
    listPlace.current = { templateId: listId, place: { query: '', scroll: 0 } };

  // Spec 15: the open template's dossier, made in the Worker when its screen is shown.
  const [doc, setDoc] = useState<{ readonly templateId: string; readonly res: DocumentationRes }>();
  const docId = s.screen === 'documentation' ? template?.templateId : undefined;
  useEffect(() => {
    if (docId === undefined || doc?.templateId === docId) return;
    void client.documentation(docId).then((res) => {
      if (res.type === 'documentation') setDoc({ templateId: docId, res });
      else if (res.type === 'failed')
        dispatch({
          type: 'input',
          ignored: [],
          problems: [{ fileName: 'the documentation', error: res.error }],
        });
    });
  }, [docId, doc, client]);
  const documentationZip = useCallback(async () => {
    const ids = (s.triage?.rows ?? []).flatMap((r) => (r.kind === 'form' ? [r.templateId] : []));
    const res = await client.documentationZip(ids);
    if (res.type === 'exported') {
      save(res.bytes, res.fileName, 'application/zip');
      dispatch({
        type: 'notice',
        notice: `Saved ${res.fileName}: the documentation of ${res.files} ${res.files === 1 ? 'form' : 'forms'}, with an index.`,
      });
    }
  }, [client, s.triage]);

  const certificateRow = s.triage?.rows.find(
    (r): r is TriageRow => r.kind === 'form' && r.templateId === s.certificateId,
  );

  // Spec 13 B2: one history entry per screen change; Back and Forward restore the place.
  const place = placeOf(s);
  const placeKey = template ? keyOf(place) : undefined;
  const screenRef = useRef(s.screen);
  screenRef.current = placeKey === undefined ? 'form' : s.screen;
  const triageScroll = useRef(0);
  useEffect(() => {
    history.scrollRestoration = 'manual';
    const pop = (e: PopStateEvent) => {
      const p = placeIn(e.state);
      // Spec 22 S4: Forward from the landing page to a task's entry runs the task again, so the
      // screen is what Back left (record 1, Fill, X-ray, the open menu, the first-step line).
      const task = taskOf(location.hash);
      if (task && homeRef.current) return void taskRef.current(task);
      if (!p) {
        // Spec 21: an address typed in the bar opens its task; the entry with none is the
        // landing page.
        const t = taskOf(location.hash);
        if (t) return void taskRef.current(t);
        void leaveRef.current().then((ok) => {
          if (!ok) return history.forward();
          // Spec 22 S5: an address the app does not know ends as on a cold load: removed, and
          // focus on the task list's heading once the landing page is drawn.
          if (location.hash !== '')
            history.replaceState(null, '', location.pathname + location.search);
          homeFocus.current = true;
          dispatch({ type: 'home' });
          setHint(undefined);
        });
        return;
      }
      if (screenRef.current === 'triage') triageScroll.current = scrollY;
      dispatch({ type: 'restore', place: p });
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  // Spec 22 F7: a notice belongs to the screen it was given on; the next screen drops it.
  const noticeAt = useRef<string>(undefined);
  useEffect(() => {
    noticeAt.current = placeKey;
  }, [s.notice]);
  useEffect(() => {
    if (s.notice !== undefined && noticeAt.current !== placeKey)
      dispatch({ type: 'notice', notice: undefined });
  }, [placeKey]);
  useEffect(() => {
    if (placeKey === undefined) return;
    // Spec 21 R4: a task's screen replaces the entry its sample opened in.
    const replace = taskRun.current;
    if (replace && (landed.current === undefined || landed.current === place.screen)) {
      taskRun.current = false;
      landed.current = undefined;
    }
    visit(
      replace
        ? {
            state: history.state as unknown,
            replaceState: (d, u) => history.replaceState(d, u),
            pushState: (d, u) => history.replaceState(d, u),
          }
        : {
            state: history.state as unknown,
            replaceState: (d, u) => history.replaceState(d, u),
            // Spec 22 F5: a screen after a task's own is not that task; its address has no hash.
            pushState: (d) => history.pushState(d, '', location.pathname + location.search),
          },
      place,
    );
    // `placeKey` says when the place changed; `place` is a new object every render. Spec 27
    // R1: a new record on the same place updates its entry, so Back and Forward return to it.
  }, [placeKey, place.recordIndex]);

  // Spec 13 B6: a new screen takes focus on its heading; back on Triage, the scroll position and
  // the certificate button it was left from come back.
  const lastKey = useRef<string>(undefined);
  useLayoutEffect(() => {
    const before = lastKey.current;
    lastKey.current = placeKey;
    // Spec 14 B12: the first screen after the landing page takes focus too.
    if (placeKey === undefined || before === placeKey) return;
    const focus = (el: Element | null | undefined) =>
      (el as HTMLElement | null | undefined)?.focus({ preventScroll: true });
    if (s.screen === 'triage') {
      window.scrollTo(0, triageScroll.current);
      const id = s.certificateId;
      focus(
        (id !== undefined && document.querySelector(`[data-afl-cert="${CSS.escape(id)}"]`)) ||
          document.getElementById('afl-triage-h'),
      );
    } else {
      window.scrollTo(0, 0);
      focus(
        s.screen === 'certificate'
          ? document.getElementById('afl-cert-h')
          : s.screen === 'documentation'
            ? document.getElementById('afl-doc-h')
            : s.screen === 'records'
              ? (document.querySelector('[data-afl-record-focus]') ??
                document.getElementById('afl-records-h'))
              : document.querySelector('.afl-form-name'),
      );
    }
  }, [placeKey]);

  // Spec 13 B7: the title names the screen first.
  useEffect(() => {
    document.title = screenTitle(
      !template
        ? undefined
        : s.screen === 'triage'
          ? { triage: s.triage?.totals.forms ?? 0 }
          : s.screen === 'certificate' && certificateRow
            ? { certificate: certificateRow.name }
            : s.screen === 'documentation'
              ? { documentation: template.ir.meta.name }
              : s.screen === 'records'
                ? { records: template.ir.meta.name }
                : { form: template.ir.meta.name },
    );
  }, [template, s.screen, s.triage, certificateRow]);

  const label =
    template && view
      ? `${template.ir.meta.name}, ${viewCaption(view)} view, ${record ? record.fileName : 'empty form'}`
      : '';

  return (
    <>
      <Header
        onFiles={(f) => void openFiles(f)}
        onSample={(id) => void openSample(id)}
        {...(template &&
          s.screen === 'form' && {
            xray: { on: s.xray, toggle: () => dispatch({ type: 'xray', on: !s.xray }) },
            onDocumentation: () => dispatch({ type: 'screen', screen: 'documentation' }),
            fill: {
              on: fillOn,
              toggle: () => void toggleFill(),
              ...(fillUnavailable !== undefined && !fillOn && { unavailable: fillUnavailable }),
            },
          })}
        {...(s.templates.length >= 2 &&
          s.screen !== 'triage' && {
            onTriage: () => dispatch({ type: 'screen', screen: 'triage' }),
          })}
      />
      <main className="afl-main" data-screen={template ? s.screen : 'landing'}>
        <div className="afl-statusbar">
          <div aria-live="polite" className="afl-status">
            {s.busy !== undefined
              ? (reading ?? `Opening ${s.busy}…`)
              : exporting
                ? reading
                : fillOn
                  ? [
                      'Filling in this form. Nothing is saved until you choose Download XML.',
                      fill.message,
                      pressNote,
                      s.notice,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : s.notice}
          </div>
          {archiving && (
            <button type="button" className="afl-button" onClick={() => client.cancel()}>
              Cancel
            </button>
          )}
          {fillOn && s.screen === 'form' && (
            // Spec 14 B3: the Fill actions have their own toolbar, beside the status line, so the
            // views and records toolbar keeps to one row.
            <div className="afl-fill-tools" role="toolbar" aria-label="Fill">
              <button
                type="button"
                className="afl-button afl-icon-b"
                data-icon="undo"
                aria-label={`Undo (${MOD}+Z)`}
                aria-keyshortcuts={`${MOD === 'Cmd' ? 'Meta' : 'Control'}+Z`}
                title={`Undo (${MOD}+Z)`}
                disabled={!fill.res || fill.res.undo === 0}
                onClick={() => fillCommand({ kind: 'undo' })}
              >
                <span className="afl-hidden">Undo</span>
              </button>
              <button
                type="button"
                className="afl-button afl-icon-b"
                data-icon="redo"
                aria-label={`Redo (Shift+${MOD}+Z)`}
                aria-keyshortcuts={`Shift+${MOD === 'Cmd' ? 'Meta' : 'Control'}+Z`}
                title={`Redo (Shift+${MOD}+Z)`}
                disabled={!fill.res || fill.res.redo === 0}
                onClick={() => fillCommand({ kind: 'redo' })}
              >
                <span className="afl-hidden">Redo</span>
              </button>
              <button
                type="button"
                className="afl-button"
                data-icon="download"
                onClick={() => void downloadXml()}
              >
                Download XML
              </button>
            </div>
          )}
        </div>
        {confirm}
        <div aria-live="polite" className="afl-hidden" data-afl-announce="">
          {announcement}
        </div>
        <ErrorBanner problems={failures} />
        {hint !== undefined && (
          <p className="afl-hint" data-icon="bulb">
            <span>{hint}</span>
            <button
              type="button"
              className="afl-link"
              onClick={() => {
                setHint(undefined);
                // Spec 22 S6: the button goes; focus goes to the screen's heading.
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>(
                      '#afl-records-h, #afl-doc-h, #afl-triage-h, #afl-cert-h, .afl-form-name, #afl-tasks-h',
                    )
                    ?.focus({ preventScroll: true }),
                );
              }}
            >
              Close tip
            </button>
          </p>
        )}
        {!template ? (
          <>
            {/* Spec 22 F2: above the landing page, where the person is looking. */}
            <Unmatched records={unmatched(s)} ignored={s.ignored} focus />
            <Landing
              onSample={(id) => void openSample(id)}
              onTriageAll={() => void openAllSamples()}
              onTask={startTask}
            />
          </>
        ) : s.screen === 'triage' && s.triage ? (
          <>
            <TriageTable
              result={s.triage}
              actions={
                <>
                  <ExportMenu onCsv={csv} />
                  {/* Spec 16 K8: in plain sight; it stays focused after the download (K7). */}
                  <button
                    type="button"
                    className="afl-button"
                    data-icon="doc"
                    onClick={() => void documentationZip()}
                  >
                    Download documentation
                  </button>
                </>
              }
              onCertificate={(templateId) => {
                triageScroll.current = scrollY;
                dispatch({ type: 'screen', screen: 'certificate', templateId });
              }}
            />
            <Unmatched records={unmatched(s)} ignored={s.ignored} />
            <PrintPlan result={s.triage} />
          </>
        ) : s.screen === 'certificate' && certificateRow ? (
          <Certificate
            row={certificateRow}
            onBack={() => dispatch({ type: 'screen', screen: 'triage' })}
            onOpenForm={() =>
              dispatch({ type: 'screen', screen: 'form', templateId: certificateRow.templateId })
            }
            onDocumentation={() =>
              dispatch({
                type: 'screen',
                screen: 'documentation',
                templateId: certificateRow.templateId,
              })
            }
          />
        ) : s.screen === 'records' ? (
          <Records
            key={template.templateId}
            formName={template.ir.meta.name}
            list={list?.templateId === template.templateId ? list : undefined}
            summarize={(q, ids) => client.summary(template.templateId, q, ids, now)}
            onNotice={(notice) => dispatch({ type: 'notice', notice })}
            place={listPlace.current.place}
            onPlace={(p) => (listPlace.current = { templateId: template.templateId, place: p })}
            onBack={() => history.back()}
            actions={(order) => (
              <ArchiveMenu
                views={template.ir.views}
                count={order.length}
                busy={exporting}
                onArchive={(v, opener) => void archive(template.templateId, v, opener, order)}
              />
            )}
            onOpen={(id, order, found) => {
              const index = records.findIndex((r) => r.recordId === id) + 1;
              // Spec 19 R1: Fill is not on here, but its unsaved changes are still asked about.
              void leaveFill().then(
                (ok) =>
                  ok &&
                  dispatch({
                    type: 'openListed',
                    index,
                    walk: { templateId: template.templateId, order, found },
                  }),
              );
            }}
          />
        ) : s.screen === 'documentation' ? (
          doc?.templateId === template.templateId ? (
            <Documentation
              dossier={doc.res.dossier}
              onBack={() => history.back()}
              onDownload={() => {
                save(
                  new TextEncoder().encode(doc.res.markdown).buffer,
                  doc.res.fileName,
                  'text/markdown;charset=utf-8',
                );
                dispatch({ type: 'notice', notice: `Saved ${doc.res.fileName}.` });
              }}
            />
          ) : (
            <p className="afl-doc">Writing the documentation…</p>
          )
        ) : (
          <div className="afl-workspace">
            <div className="afl-work">
              {view && (
                <PaperToolbar
                  formName={template.ir.meta.name}
                  views={template.ir.views}
                  view={view.name}
                  onView={(v) => dispatch({ type: 'view', view: v })}
                  records={records}
                  index={s.recordIndex}
                  {...(s.walk?.templateId === template.templateId && {
                    walk: {
                      order: s.walk.order
                        .map((id) => records.findIndex((r) => r.recordId === id) + 1)
                        .filter((i) => i > 0),
                      found: s.walk.found,
                    },
                  })}
                  {...(records.length > 0 && {
                    onRecords: () => dispatch({ type: 'screen', screen: 'records' }),
                  })}
                  onIndex={(i) =>
                    void (fillOn ? leaveFill() : Promise.resolve(true)).then(
                      (ok) => ok && dispatch({ type: 'record', index: i }),
                    )
                  }
                  actions={
                    <>
                      {records.length > 0 && (
                        <ExportRecords
                          busy={exporting}
                          onExport={(f) => void exportRecords(template.templateId, f)}
                          views={template.ir.views}
                          startOpen={keepOpen}
                          onArchive={(v, opener) => void archive(template.templateId, v, opener)}
                        />
                      )}
                    </>
                  }
                />
              )}
              {render?.type === 'failed' && (
                <ErrorBanner problems={[{ fileName: template.fileName, error: render.error }]} />
              )}
              {fillOn && fill.res && fill.res.invalid.length > 0 && (
                <Attention count={fill.res.invalid.length} />
              )}
              {rendered && (
                <>
                  <p className="afl-print-caption">{label}</p>
                  <DrawError
                    retry={fillOn ? fill.res : rendered}
                    filling={fillOn}
                    onHome={() =>
                      void leaveRef.current().then((ok) => {
                        if (!ok) return;
                        history.pushState(null, '', location.pathname + location.search);
                        homeFocus.current = true;
                        dispatch({ type: 'home' });
                      })
                    }
                  >
                    <Paper
                      result={rendered}
                      {...(fillOn &&
                        fill.res && { fill: { res: fill.res, onCommand: fillCommand } })}
                      {...(fillOn && traced !== undefined && { traced })}
                      label={label}
                      xray={s.xray}
                      outlined={outlined}
                      {...(reveal !== undefined && { reveal })}
                      onPoint={onPoint}
                      onText={onPaperText}
                      fade={render?.type === 'rendered' && render.first === true && !fillOn}
                    />
                  </DrawError>
                  {(rendered.issues.length > 0 || fontNote) && (
                    <details className="afl-notes" open={fontNote || undefined}>
                      <summary>Notes ({rendered.issues.length + (fontNote ? 1 : 0)})</summary>
                      <ul>
                        {fontNote && (
                          <li>
                            Some characters are shown in a system font: their Calibri font could not
                            load while offline.
                          </li>
                        )}
                        {rendered.issues.map((i, n) => (
                          <li key={n}>{i.message}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
            <aside className="afl-side" aria-label="About this form">
              {card && (
                <DetailsCard
                  card={card}
                  onConnection={(connectionId) =>
                    dispatch({ type: 'tab', tab: 'connections', connectionId })
                  }
                />
              )}
              <SideTabs
                tab={s.tab === 'trace' && !fillOn ? 'fields' : s.tab}
                onTab={(tab) => dispatch({ type: 'tab', tab })}
                trace={fillOn}
                panels={{
                  trace: fillOn && (
                    <RuleTrace ir={template.ir} entries={fill.trace} onOutline={setTraced} />
                  ),
                  fields: (
                    <FieldTree
                      ir={template.ir}
                      selected={s.selection.fieldId}
                      onSelect={selectField}
                    />
                  ),
                  connections: (
                    <DataConnections
                      ir={template.ir}
                      current={s.connectionId}
                      onField={(fieldId) => {
                        selectField(fieldId);
                        dispatch({ type: 'tab', tab: 'fields' });
                      }}
                    />
                  ),
                }}
              />
              <Unmatched records={unmatched(s)} ignored={s.ignored} />
            </aside>
          </div>
        )}
      </main>
      <RuleDialog messages={messages} onDone={() => setMessages([])} />
      <Notices />
    </>
  );
}
