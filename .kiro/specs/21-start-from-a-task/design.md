# Spec 21 design

## Tasks: `apps/web/src/shell/tasks.ts`
- `TASKS`: `{ id, sample ('all' for Triage), label, hint }`, ids `read`, `rules`, `fill`, `find`,
  `keep`, `document`, `triage`. `taskOf(hash)` gives the task or `undefined`.
- `Landing.tsx`: "Start with a task", a list of real links (`href="#id"`), so the address can be
  copied or opened in a new tab; a plain click is handled in the page.

## Landing on a task (`App.tsx`)
- `startTask(t)`: `history.pushState(null, '', '#id')`, then `runTask(t)`: open the sample (or all
  samples) through the existing `openSample`/`openAllSamples`, clear the "already open" notice,
  and set `pending`.
- An effect applies `pending` once the template and view are open (Triage: once the screen is
  Triage): record 1 for `read` and `fill`; `xray` on; `toggleFill()` then the `trace` tab; the
  `records` or `documentation` screen; `ExportRecords startOpen` for `keep`. Then the hint.
- History: the pushed entry has no state; spec 13's `visit` fills it with the first place. A
  task's own screen change (`records`, `documentation`) replaces that entry instead of adding
  one, so Back from where a task lands is the landing page's entry.
- `popstate` with no place: a known `#task` (typed in the bar) runs it; otherwise the landing
  page: `leaveFill()` asks about unsaved changes (No → `history.forward()`), then the new store
  action `home` drops `openId` and the certificate; focus on `#afl-tasks-h`.
- At start: any hash is removed with `replaceState`; a known one is then pushed and run, so the
  entry below it is the landing page.

## The hint
- `<p class="afl-hint">` above the screen: the text and "Close tip". Said once through the
  existing polite region (`say`) 300 ms after landing, after the screen's focus move.
- Gone on the first `pointerdown`, `input` or `change` outside it (capture listeners).

## Defaults taken
- Back from a plain sample (not a task) still leaves the page, as spec 13 has it.
- Task 3 and task 1 open record 1, so there is a trace to read about real values.
- The "keep" choices stay open until the person acts; an unknown hash is removed silently.
- Choosing a task while another sample is open adds the sample to the session.
