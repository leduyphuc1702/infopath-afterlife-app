import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fromDataTransfer, sortInput } from './files/collect';
import { Paper } from './paper/Paper';
import { PaperToolbar, viewCaption } from './paper/PaperToolbar';
import { ErrorBanner } from './shell/ErrorBanner';
import { Header } from './shell/Header';
import { Landing } from './shell/Landing';
import { loadPaperFonts } from './shell/fonts';
import { sampleName } from './shell/sample-names';
import { cardFor, cardForControl } from './side/card';
import { DetailsCard } from './side/DetailsCard';
import { FieldTree } from './side/FieldTree';
import { TemplateList } from './side/TemplateList';
import { Unmatched } from './side/Unmatched';
import { initialState, openTemplate, recordsOf, reducer, unmatched, type Problem } from './store';
import { localNow, WorkerClient } from './worker/client';
import type { FailedRes, RenderedRes, ResBody } from './worker/protocol';

/** The latest render answer; the previous paper stays up while the next one is drawn. */
type Render = RenderedRes | FailedRes;

export function App() {
  const client = useMemo(() => new WorkerClient(), []);
  const [now] = useState(localNow);
  const [s, dispatch] = useReducer(reducer, initialState);
  const [render, setRender] = useState<Render>();
  const known = useRef(new Set<string>());
  const latest = useRef(0);

  useEffect(() => () => client.terminate(), [client]);

  /** Applies a Worker answer to an open request; opens the first template it added. */
  const applySession = useCallback((res: ResBody, what: string) => {
    dispatch({ type: 'busy' });
    if (res.type !== 'session') {
      if (res.type === 'failed')
        dispatch({ type: 'input', ignored: [], problems: [{ fileName: what, error: res.error }] });
      return;
    }
    const added = res.templates.find((t) => !known.current.has(t.templateId));
    for (const t of res.templates) known.current.add(t.templateId);
    dispatch({ type: 'session', session: res, ...(added && { open: added.templateId }) });
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
      const [res] = await Promise.all([client.open(c.files), loadPaperFonts()]);
      applySession(res, 'the files');
    },
    [client, applySession],
  );

  const openSample = useCallback(
    async (id: string) => {
      dispatch({ type: 'busy', what: sampleName(id) });
      const [res] = await Promise.all([client.openSample(id), loadPaperFonts()]);
      applySession(res, sampleName(id));
    },
    [client, applySession],
  );

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
    if (!template || !view) return;
    const ticket = ++latest.current;
    void client.render(template.templateId, view.name, record?.recordId, now).then((r) => {
      if (ticket !== latest.current) return; // a newer request is on its way
      if (r.type === 'rendered' || r.type === 'failed') setRender(r);
    });
  }, [client, now, template, view, record]);

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
  const card =
    template &&
    (s.selection.fieldId !== undefined
      ? cardFor(template.ir, s.selection.fieldId)
      : s.selection.controlId !== undefined
        ? cardForControl(template.ir, s.selection.controlId)
        : undefined);

  const label =
    template && view
      ? `${template.ir.meta.name}, ${viewCaption(view)} view, ${record ? record.fileName : 'empty form'}`
      : '';

  return (
    <>
      <Header
        onFiles={(f) => void openFiles(f)}
        onSample={(id) => void openSample(id)}
        {...(template && {
          xray: { on: s.xray, toggle: () => dispatch({ type: 'xray', on: !s.xray }) },
        })}
      />
      <main className="afl-main">
        <div aria-live="polite" className="afl-status">
          {s.busy !== undefined && `Opening ${s.busy}…`}
        </div>
        <ErrorBanner problems={failures} />
        {!template ? (
          <>
            <Landing onSample={(id) => void openSample(id)} />
            <Unmatched records={unmatched(s)} ignored={s.ignored} />
          </>
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
                  />
                  {render.issues.length > 0 && (
                    <details className="afl-notes">
                      <summary>Notes ({render.issues.length})</summary>
                      <ul>
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
              {s.templates.length > 1 && (
                <TemplateList
                  templates={s.templates}
                  openId={s.openId}
                  recordsOf={(id) => recordsOf(s, id).length}
                  onOpen={(id) => dispatch({ type: 'open', templateId: id })}
                />
              )}
              {card && <DetailsCard card={card} />}
              <section className="afl-panel" aria-labelledby="afl-fields">
                <h2 id="afl-fields">Fields</h2>
                <FieldTree
                  ir={template.ir}
                  selected={s.selection.fieldId}
                  onSelect={(fieldId) =>
                    dispatch({ type: 'select', selection: { fieldId, from: 'tree' } })
                  }
                />
              </section>
              <Unmatched records={unmatched(s)} ignored={s.ignored} />
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
