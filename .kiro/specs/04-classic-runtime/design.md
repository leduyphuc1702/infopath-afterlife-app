# Spec 04 design: Classic runtime

Requirements: `requirements.md` (R1–R11, corpus facts, E1–E5). Code in
`packages/core/src/runtime/`, exported from `src/index.ts`; the web viewer adds a Fill mode on
top of spec 09.

## 1. Shape

```
main thread                         Worker                               core
-----------                         ------                               ----
Fill toggle ──fillOpen────────────► Session.fill(templateId, recordId) ─► new FillSession(ir, xsn, bytes, now)
paper control ─edit/press/…───────► FillSession.apply(cmd, now) ────────► cycle → renderView(dom bytes)
◄─ filled {html, css, marks, invalid, trace, view, canUndo, canRedo, dirty}
Download ─────download────────────► FillSession.serialise() ───────────► bytes (transferred)
```

| # | Decision | Why |
|---|---|---|
| D1 | **`FillSession` is pure core**: no Worker, no clock. `now` comes with each command (R3.3). The Worker's `Session` keeps at most one, for the open template. | Same code for the Forge Classic portal later; tests run in Node. |
| D2 | **Render by bytes.** After a cycle the DOM is serialised and given to spec 03's `renderView` as `record`. | One renderer; spec 03's sanitiser, marks and limits apply unchanged. Form 08 render p95 is 17.70 ms in a Worker, inside R2.4 (E2). If profiling shows parsing dominates, add a `dom` input to `renderView` later. |
| D3 | **Paths are spec 03's mark paths** (`/my:a[1]/my:b[2]`, with positions), from `ControlMark.path`. Commands carry them; the session resolves them with `xpath` against the DOM and rejects anything that is not a plain positional child path (R1.4). | The page already has them on `data-afl-path`; no second addressing scheme. |
| D4 | **No incremental render.** Every answer is a full render of the current view. | Correctness first; budget measured, not assumed. |

## 2. Expressions (R3)

| # | Decision | Why |
|---|---|---|
| D5 | `runtime/evaluate.ts` wraps `xpath`'s `parse(expr).evaluate({node, namespaces, functions, variables})`. Namespaces: the manifest's prefixes plus `xdMath`, `xdDate`, `xdXDocument`, `xdUser`, `xdFormatting`, `msxsl`. Compiled expressions are cached per session. | `xpath` is already a dependency (via `xsltjs`); no new one. |
| D6 | **Function table** in `runtime/functions.ts`, values from `xpath-fns/values.ts` and `format.ts`: `Nz`, `Today`, `Now`, `AddDays`, `AddSeconds`, `GetDOM`, `get-UserName`, `string-compare`, `formatString`, `Avg`, `Max`, `Min`, `Eval`. Anything else resolves to a function that throws `NotEvaluated(name)`; the cycle catches it (R3.2). | One list to read; unknown functions never guess. |
| D7 | **Number text**: an assignment or calculation of a number writes XPath 1.0 `string()` of it, as the `xpath` package gives it (`1220.1399999999999`). InfoPath's MSXML text for such sums is [VERIFY]; the oracle compares numbers (E1). | Follows the spec of the language the expression is written in; nothing invented. |
| D8 | **`GetDOM(name)`** returns the secondary instance's document: parsed once from the `.xsn` file the `xmlFileAdapter` names (form 03 `Locations`); for a query connection an empty document, with one trace entry per session (R3.4). Changed in task 1: no template of ours ships a sample instance for a query source, so there is no "sample file" branch. Writes into it (form 04's `queryFields`) select nothing and are skipped with a trace entry. | Form 04's "Check budget" assigns into `BudgetService` before its query. |

## 3. Dependencies and the cycle (R2)

| # | Decision | Why |
|---|---|---|
| D9 | **Static graph from FormIR**: `ir.dependencies.references` (spec 02 R12, P13) gives, per calculation and rule, the fields it reads. The session builds `readers: fieldId → calcs/rules` and a topological order of calculations; cycles in the graph are allowed and fall to the pass cap. | Spec 02 already proved the index complete (P13). |
| D10 | **Instance level**: a change is a set of changed DOM nodes. For each, the field id is found by the node's schema path (`dataStep` from `ir/ids.ts`); readers are evaluated for every instance of their target (D11). | Repeating rows have many nodes per field id. |
| D11 | **Calculation instances**: one evaluation per node of the target field, with that node as context (`../my:quantity` from `lineTotal` is its row's quantity). A target node that does not exist is skipped. Changed in task 2: this line said "the node's parent"; the manifest's expressions are relative to the target itself. | R2.3; matches the 6 in-row targets. |
| D12 | **Cycle** (`runtime/cycle.ts`): `pass = 0; dirty = {written}`; loop: run field-change rule sets whose `match` selects a dirty node (D13), then calculations in topological order whose inputs intersect dirty; nodes whose text changed become the next dirty set; stop when empty or `pass == 16` (loop entry with the still-dirty fields, R2.2). Then validate all (D16), then render. | Simple, bounded, deterministic; P7 and P18 test it. |
| D13 | **Field-change triggers** fire on any write, including a calculation's, inside the cap. onLoad rule sets run once at open (E3), then a cycle with every calculated field dirty. | InfoPath fires rules on calculated changes; E3. |
| D14 | **Value write** sets the element's text (or attribute value); empty string removes child nodes; an `xsi:nil="true"` is removed when a value is written and added back when a nillable non-string field is emptied. | Records must stay schema-valid (R8.2, R11.4). |

## 4. Rules (R4)

| # | Decision | Why |
|---|---|---|
| D15 | `runtime/rules.ts` runs `IrRule`s of one `ruleSet` in order. Condition `undefined` is true. Actions by `IrAction.kind`: `assignmentAction` (`targetField` relative to the context, `expression`); `switchViewAction` (`view` name → view id, applied after the cycle); `dialogBoxExpressionAction` and `dialogBoxAction` (text queued in the answer as `dialogs[]`); `exitRuleSet` and `stopProcessing` end the set; `queryAction`, `submitAction`, `closeDocumentAction`, anything else: a skipped trace entry, plus for submit and close a `notice`. Button triggers match `Trigger.button` to the clicked control's `CtrlId`. | Covers every action kind in the corpus (assignment 7, switch view 3, query 1, dialog 1). |

## 5. Validation (R5)

| # | Decision | Why |
|---|---|---|
| D16 | `runtime/validate.ts` checks every bound field node: required = spec 03 marks' rule (`required` or blank check, the Required chip's source); type = the builtin `xsdType` with XSD lexical patterns (double, decimal, integer and its subtypes, date, time, dateTime, boolean), empty is valid unless required; facets enumeration, length, min/max length, pattern (XSD regex translated for the 1 pattern we have; an untranslatable one is not evaluated, with a trace entry); `errorCondition`s by `match` with `expressionContext`. Result: `invalid[] {path, fieldId, message, short}` in view order. | The four sources in R5.1; messages come from the manifest or fixed English text ("Only numbers allowed", "Only dates allowed", "Cannot be blank"). |
| D17 | The page draws state with a class on the marked element (`afl-invalid`: `outline: 1px dashed #c00`, InfoPath's look) and ARIA attributes; core's HTML is not changed. | Invalid state changes without re-sanitising; X-ray reads the same marks. |

## 6. Repeating rows and optional sections (R7)

| # | Decision | Why |
|---|---|---|
| D18 | **Fragments**: per `xsf:xmlToEdit` with `xCollection`, the `xsf:fragmentToInsert/xsf:chooseFragment` content (21 in 17 forms) parsed once; else an item built from the schema tree: required children, defaults and fixed values, nested required groups. FormIR does not hold fragments today, so task 4 adds `IrGroup.insert?: {fragment, item, container}` read by spec 02's builder. | Brief AC 4; the manifest's fragment carries InfoPath's own defaults. |
| D19 | Insert above/below/after last uses `insertBefore` on the row node; remove refuses when the schema's `minOccurs` would be broken; `xOptional` insert uses the same fragment rule, remove deletes the node. Each is one command with one undo step, followed by a cycle with every reader of the group dirty. | Totals update after a row change. |
| D20 | The page adds "Insert item" links and a row menu (spec 09 `useMenu`) next to each marked row; their placement comes from marks on the row's container, which task 4 adds to spec 03's marks (`kind: 'row' | 'optional' | 'collection'`). | Rows need targets the main thread can find. |

## 7. Main thread (R6)

| # | Decision | Why |
|---|---|---|
| D21 | `apps/web/src/paper/fill.ts` upgrades controls after each render: by `data-afl-ctrl` it finds the control's `xctname` and sets `contenteditable="plaintext-only"`, removes `disabled`, attaches listeners. Commits on blur, Enter (single-line) or change (choice controls). DTPicker accepts ISO or the view's `formatString` date pattern parsed back by `xpath-fns/format.ts`'s inverse for the 4 date patterns in the corpus; anything else is written as typed and fails type validation visibly. | No second renderer (decision 2); typing stays native. |
| D22 | **Focus restore** keeps `{path, caret}` before sending; after render, focuses `[data-afl-path="…"]` and sets the caret; on remove, the row above, else the "Insert item" link. | R6.3. |
| D23 | Read-only controls (R6.2) get `aria-readonly="true"` and a `title`; the paper stays sanitised: fill never inserts HTML from the Worker other than core's render. | Security rule: render output is already sanitised; we only add attributes. |
| D24 | Fill is a toolbar toggle beside "Export records", shown for the empty form and exact-version records (R1.5). Leaving Fill, switching record or template with undownloaded changes asks in a `<dialog>`. | Nothing is stored, so leaving loses work. |

## 8. Trace and undo (R9, R10)

| # | Decision | Why |
|---|---|---|
| D25 | `TraceEntry {seq, at, kind: 'rule'|'calc'|'validation'|'skipped'|'loop'|'notEvaluated', trigger?: path, caption, condition?: boolean, changes: {path, before, after}[]}`. The session keeps the last 500; answers carry only new entries. | R9.1; bounded memory. |
| D26 | Undo stack of serialised DOM strings (main and written secondary instances), cap 100, plus the view id; undo restores and re-validates without running rules. | XML snapshots as decided; a form 08 record is about 20 KB, so 100 snapshots are 2 MB. |

## 9. Protocol (Worker)

New requests: `fillOpen {templateId, recordId?}`, `fill {command}`, `fillClose`. Answer
`filled {html, css, marks, invalid, trace, dialogs, notices, viewId, canUndo, canRedo, dirty,
ms}`; `download` answers `filledXml {fileName, bytes}` with the bytes transferred. Errors use
the existing `failed` answer with new codes `FILL_PATH` and `FILL_STATE` (messages in
`apps/web/src/messages.ts`). `ms` is the cycle time measured in the Worker (R2.4).

## 10. Tests

| Test | What |
|---|---|
| `test/runtime/evaluate.test.ts` | each function in D6; unknown function → not evaluated |
| `test/runtime/cycle.test.ts` | form 02 total, form 04 chain and rows, form 01 onLoad; loop entry on a generated cycle |
| `test/property/p7.property.test.ts` | R11.1, generated graphs ≤ 30 fields, 300 runs |
| `test/property/p18.property.test.ts` | R11.2 over every own record, 100 runs |
| `test/runtime/calc-oracle.test.ts` | R11.3: logs matches; mismatches listed with the expression |
| `test/runtime/validate.test.ts`, `validate-oracle.test.ts` | R5.1 kinds; R11.4 |
| `test/property/p3.property.test.ts` | R7.4, forms with `xCollection`, 200 runs |
| `test/runtime/rules.test.ts` | forms 03, 04, 05 actions; skipped query; submit notice |
| `test/perf/fill.perf.test.ts`, browser test | R2.4 on forms 04 and 08, Node and Worker |
| `apps/web/e2e/fill.spec.ts` | R11.5, R6.3, R4.2 dialog, R9.2 trace hover, R10.1 |

Bundle: the runtime lands in the Worker chunk (133.7 of 160 KB gzip today); `fill.ts` and the
trace tab in the entry (72.8 of 100). If either passes its budget, the trace tab becomes a lazy
chunk with its own line in `budget.test.ts`.
