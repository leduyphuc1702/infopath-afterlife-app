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
import { Paper } from './paper/Paper';
import { RuleDialog } from './paper/RuleDialog';
import { PaperToolbar, viewCaption } from './paper/PaperToolbar';
import { ErrorBanner } from './shell/ErrorBanner';
import { Header } from './shell/Header';
import { Landing } from './shell/Landing';
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
  ResBody,
} from './worker/protocol';
import { DISCARD, useConfirm } from './shell/Confirm';

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
  const applySession = useCallback((res: ResBody, what: string, triage = false) => {
    dispatch({ type: 'busy' });
    setReading(undefined);
    if (res.type !== 'session') {
      if (res.type === 'failed')
        dispatch({ type: 'input', ignored: [], problems: [{ fileName: what, error: res.error }] });
      return;
    }
    const added = res.templates.find((t) => !known.current.has(t.templateId));
    for (const t of res.templates) known.current.add(t.templateId);
    // Spec 13 B3: files already open add nothing; the template they are is shown again.
    const again = [
      ...new Set(res.duplicates.flatMap((d) => (d.templateId === undefined ? [] : [d.templateId]))),
    ];
    const open = added?.templateId ?? (again.length === 1 ? again[0] : undefined);
    const screen =
      triage && (added ? res.templates.length >= 2 : again.length >= 2)
        ? 'triage'
        : open !== undefined
          ? 'form'
          : undefined;
    const notice = alreadyOpen(res.duplicates.map((d) => d.fileName));
    dispatch({
      type: 'session',
      session: res,
      ...(open !== undefined && { open }),
      ...(screen && { screen }),
      ...(notice !== undefined && { notice }),
    });
    return res;
  }, []);

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
      applySession(res, sampleName(id));
    },
    [client, applySession, progress],
  );

  // Spec 12 R4.5: every bundled sample, straight to Triage.
  const openAllSamples = useCallback(async () => {
    dispatch({ type: 'busy', what: 'all samples' });
    const [res] = await Promise.all([client.openAllSamples(progress), loadPaperFonts()]);
    applySession(res, 'the samples', true);
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
      } else if (res.type === 'failed')
        dispatch({
          type: 'input',
          ignored: [],
          problems: [{ fileName: 'the export', error: res.error }],
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
  const fillAnswer = useCallback((r: ResBody, message?: string) => {
    if (r.type === 'filled') {
      setFill(
        (f) =>
          f && {
            ...f,
            res: r,
            view: viewRef.current ?? f.view,
            trace: [...f.trace, ...r.trace].slice(-500),
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
  const fillCommand = useCallback(
    (c: FillCommand) => {
      const v = viewRef.current;
      if (v !== undefined) void client.fill(c, v, localNow()).then((r) => fillAnswer(r));
    },
    [client, fillAnswer],
  );
  /** Leaves Fill; asks first when there are changes that were not downloaded (R6.4). */
  const leaveFill = useCallback(async (): Promise<boolean> => {
    if (!fill) return true;
    if (fill.res?.dirty && !(await ask(DISCARD))) return false;
    setFill(undefined);
    void client.fillClose();
    return true;
  }, [fill, ask, client]);
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
      trace: r.trace.filter((e) => e.kind !== 'validation').slice(-500),
      ...(r.workedOut > 0 && {
        message: `${r.workedOut} calculated ${r.workedOut === 1 ? 'field was' : 'fields were'} empty in this record and ${r.workedOut === 1 ? 'has' : 'have'} been worked out.`,
      }),
    });
  }, [template, view, record, s.recordIndex, fillOn, leaveFill, client, fillAnswer]);
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
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
      if (!p) return;
      if (screenRef.current === 'triage') triageScroll.current = scrollY;
      dispatch({ type: 'restore', place: p });
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (placeKey !== undefined) visit(history, place);
    // `placeKey` says when the place changed; `place` is a new object every render.
  }, [placeKey]);

  // Spec 13 B6: a new screen takes focus on its heading; back on Triage, the scroll position and
  // the certificate button it was left from come back.
  const lastKey = useRef<string>(undefined);
  useLayoutEffect(() => {
    const before = lastKey.current;
    lastKey.current = placeKey;
    if (before === undefined || placeKey === undefined || before === placeKey) return;
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
        <div aria-live="polite" className="afl-status">
          {s.busy !== undefined
            ? (reading ?? `Opening ${s.busy}…`)
            : exporting
              ? reading
              : fillOn
                ? [
                    'Filling in this form. Nothing is saved until you choose Download XML.',
                    fill.message,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : s.notice}
        </div>
        {confirm}
        <div aria-live="polite" className="afl-hidden" data-afl-announce="">
          {announcement}
        </div>
        <ErrorBanner problems={failures} />
        {!template ? (
          <>
            <Landing
              onSample={(id) => void openSample(id)}
              onTriageAll={() => void openAllSamples()}
            />
            <Unmatched records={unmatched(s)} ignored={s.ignored} />
          </>
        ) : s.screen === 'triage' && s.triage ? (
          <>
            <TriageTable
              result={s.triage}
              actions={<ExportMenu onCsv={csv} />}
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
          />
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
                        />
                      )}
                      {fillOn && (
                        <>
                          <button
                            type="button"
                            className="afl-button"
                            aria-label={`Undo (${MOD}+Z)`}
                            aria-keyshortcuts={`${MOD === 'Cmd' ? 'Meta' : 'Control'}+Z`}
                            title={`Undo (${MOD}+Z)`}
                            disabled={!fill.res || fill.res.undo === 0}
                            onClick={() => fillCommand({ kind: 'undo' })}
                          >
                            Undo
                          </button>
                          <button
                            type="button"
                            className="afl-button"
                            aria-label={`Redo (Shift+${MOD}+Z)`}
                            aria-keyshortcuts={`Shift+${MOD === 'Cmd' ? 'Meta' : 'Control'}+Z`}
                            title={`Redo (Shift+${MOD}+Z)`}
                            disabled={!fill.res || fill.res.redo === 0}
                            onClick={() => fillCommand({ kind: 'redo' })}
                          >
                            Redo
                          </button>
                          <button
                            type="button"
                            className="afl-button"
                            onClick={() => void downloadXml()}
                          >
                            Download XML
                          </button>
                        </>
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
                  <Paper
                    result={rendered}
                    {...(fillOn && fill.res && { fill: { res: fill.res, onCommand: fillCommand } })}
                    {...(fillOn && traced !== undefined && { traced })}
                    label={label}
                    xray={s.xray}
                    outlined={outlined}
                    {...(reveal !== undefined && { reveal })}
                    onPoint={onPoint}
                    onText={onPaperText}
                    fade={render?.type === 'rendered' && render.first === true && !fillOn}
                  />
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
