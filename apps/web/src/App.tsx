import type { TriageRow } from '@afterlife/core';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fromDataTransfer, sortInput } from './files/collect';
import { Paper } from './paper/Paper';
import { PaperToolbar, viewCaption } from './paper/PaperToolbar';
import { ErrorBanner } from './shell/ErrorBanner';
import { Header } from './shell/Header';
import { Landing } from './shell/Landing';
import { Notices } from './shell/Notices';
import { loadPaperFonts, onDemandFacesFailed } from './shell/fonts';
import { sampleName } from './shell/sample-names';
import { cardFor, cardForControl } from './side/card';
import { DataConnections } from './side/DataConnections';
import { DetailsCard } from './side/DetailsCard';
import { FieldTree } from './side/FieldTree';
import { SideTabs } from './side/SideTabs';
import { Unmatched } from './side/Unmatched';
import { Certificate } from './triage/Certificate';
import { ExportMenu } from './triage/ExportMenu';
import { PrintPlan } from './triage/PrintPlan';
import { TriageTable } from './triage/TriageTable';
import { initialState, openTemplate, recordsOf, reducer, unmatched, type Problem } from './store';
import { localNow, WorkerClient } from './worker/client';
import type { FailedRes, Progress, RenderedRes, ResBody } from './worker/protocol';

/** The latest render answer; the previous paper stays up while the next one is drawn. */
/** `templateId`: the template it was made for; another template's render is never shown. */
type Render = (RenderedRes | FailedRes) & { readonly first?: boolean; readonly templateId: string };

export function App() {
  const client = useMemo(() => new WorkerClient(), []);
  const [now] = useState(localNow);
  const [s, dispatch] = useReducer(reducer, initialState);
  const [latestRender, setRender] = useState<Render>();
  const known = useRef(new Set<string>());
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
    const screen =
      triage && added && res.templates.length >= 2 ? 'triage' : added ? 'form' : undefined;
    dispatch({
      type: 'session',
      session: res,
      ...(added && { open: added.templateId }),
      ...(screen && { screen }),
    });
  }, []);

  const openFiles = useCallback(
    async (files: File[]) => {
      const c = sortInput(files);
      const problems: Problem[] = [
        ...c.rejected,
        ...(c.tooMany ? [{ fileName: '', error: c.tooMany }] : []),
      ];
      dispatch({ type: 'input', ignored: c.ignored, problems });
      if (c.files.length === 0) return;
      dispatch({
        type: 'busy',
        what: c.files.length === 1 ? c.files[0]!.name : `${c.files.length} files`,
      });
      const [res] = await Promise.all([client.open(c.files, progress), loadPaperFonts()]);
      applySession(res, 'the files', true);
    },
    [client, applySession, progress],
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

  useEffect(() => {
    if (!template || !view || s.screen !== 'form') return;
    const ticket = ++latest.current;
    void client.render(template.templateId, view.name, record?.recordId, now).then((r) => {
      if (ticket !== latest.current) return; // a newer request is on its way
      if (r.type !== 'rendered' && r.type !== 'failed') return;
      // R9.3: the first successful render of each template fades in.
      const first = r.type === 'rendered' && !faded.current.has(template.templateId);
      if (first) faded.current.add(template.templateId);
      setRender({ ...r, first, templateId: template.templateId });
    });
  }, [client, now, template, view, record, s.screen]);

  // The previous paper stays up while the next render of the same template is drawn; a render
  // of another template (opened from Triage, or a stale failure) is not shown under this one.
  const render = latestRender?.templateId === template?.templateId ? latestRender : undefined;

  // X-ray (R5): marks[i] is the i-th `[data-afl-ctrl]` element (design §5).
  const rendered = render?.type === 'rendered' ? render : undefined;
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
          })}
        {...(s.templates.length >= 2 &&
          s.screen !== 'triage' && {
            onTriage: () => dispatch({ type: 'screen', screen: 'triage' }),
          })}
      />
      <main className="afl-main">
        <div aria-live="polite" className="afl-status">
          {s.busy !== undefined && (reading ?? `Opening ${s.busy}…`)}
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
              onCertificate={(templateId) =>
                dispatch({ type: 'screen', screen: 'certificate', templateId })
              }
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
                  onIndex={(i) => dispatch({ type: 'record', index: i })}
                />
              )}
              {render?.type === 'failed' && (
                <ErrorBanner problems={[{ fileName: template.fileName, error: render.error }]} />
              )}
              {render?.type === 'rendered' && (
                <>
                  <Paper
                    result={render}
                    label={label}
                    xray={s.xray}
                    outlined={outlined}
                    {...(reveal !== undefined && { reveal })}
                    onPoint={onPoint}
                    onText={onPaperText}
                    fade={render.first === true}
                  />
                  {(render.issues.length > 0 || fontNote) && (
                    <details className="afl-notes" open={fontNote || undefined}>
                      <summary>Notes ({render.issues.length + (fontNote ? 1 : 0)})</summary>
                      <ul>
                        {fontNote && (
                          <li>
                            Some characters are shown in a system font: their Calibri font could not
                            load while offline.
                          </li>
                        )}
                        {render.issues.map((i, n) => (
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
                tab={s.tab}
                onTab={(tab) => dispatch({ type: 'tab', tab })}
                panels={{
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
      <Notices />
    </>
  );
}
