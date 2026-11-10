---
name: spec
description: Turn a spec brief in docs/spec-briefs/NN-*.md into a Kiro spec under .kiro/specs/NN-<name>/ (requirements.md, then design.md, then tasks.md), one phase at a time with a human approval stop after each. Use when the user says "spec", "start spec NN", "write the requirements/design/tasks for brief NN", "next phase", or asks to execute tasks from a spec.
---

# Spec: brief → requirements → design → tasks

The brief is the input; the spec is the contract the code is written against. The folder name
copies the brief's file name: `docs/spec-briefs/01-xsn-parser.md` → `.kiro/specs/01-xsn-parser/`.

## Rules for every phase

- **One phase per turn.** Write only that phase's file, then stop and ask for approval. Do not
  start the next phase until the human says it is approved. If a later phase shows that an
  earlier file is wrong, propose the edit and stop; do not change an approved file silently.
- **Read before writing:** the brief, all steering in `.kiro/steering/`, `docs/feature-coverage.md`,
  the specs this one depends on, and the real sample files the brief talks about
  (`samples/own/`, `samples/public/`). Check every claim about the file format against a sample,
  and write down the count, file and date. Mark anything unchecked `[VERIFY: …]`.
- **Traceability.** Every brief acceptance criterion (AC n) and property (P n) maps to at least one
  requirement. Anything not in the brief is marked `Added:` with the reason (coverage doc,
  steering, evidence in a sample).
- **Corrections.** If the brief or steering is wrong about the format, say so with the evidence
  and write the requirement to match the evidence. List the doc edits as open questions; do not
  edit steering, briefs or `samples/` yourself.
- Never commit, push or publish. The human reviews and commits.

## Phase 1: `requirements.md`

1. **Introduction:** what the spec delivers, who uses the output, what is out of scope, and which
   later spec owns each thing left out.
2. **Glossary:** every term the criteria use, one line each. Use InfoPath words (product.md).
3. **Requirements**, numbered `R1`, `R2`, …:
   - heading `### R<n>. <title>` and a `Traces:` line (`brief AC 3`, `brief P1`, or `Added: …`);
   - a user story: "As <persona from product.md>, I want …, so that …";
   - acceptance criteria numbered `R<n>.<m>`, each in EARS form:
     - `THE SYSTEM SHALL …` (always);
     - `WHEN <event>, THE SYSTEM SHALL …`;
     - `WHILE <state>, THE SYSTEM SHALL …`;
     - `IF <unwanted condition>, THEN THE SYSTEM SHALL …`;
     - `WHERE <option or environment>, THE SYSTEM SHALL …`;
   - each criterion names its oracle: the sample, count, file or command that proves it.
4. **Correctness properties:** each P-number is its own requirement, `R<n>. Property P<k>: …`, with
   the input domain (what the generator produces), the claim ("for any …") and the bound (runs,
   time). P-numbers are global (see `testing.md`); a new property takes the next free number.
5. **Traceability table:** brief item → requirement ids.
6. **Open questions** for the human, each with the default you will assume if there is no answer.

## Phase 2: `design.md`

- **Architecture:** components and data flow; where each runs (Node, browser, Web Worker, Forge).
- **Module layout** under the paths in `structure.md`; public API only through
  `packages/core/src/index.ts`.
- **Data types:** TypeScript interfaces for every public input and output.
- **Error model:** `AfterlifeError` codes and their detail fields; what is fatal and what is
  collected as an issue.
- **Decisions:** for each non-obvious choice, the alternatives, the choice and why. Check each one
  against `tech.md` (runtimes, allowed libraries, platform limits, performance budgets).
- **Test plan:** a table of requirement or property id → test kind (unit, golden, property,
  performance, browser) → fixture → test file.
- **Risks** and how the first tasks retire them.

## Phase 3: `tasks.md`

- A checkbox list, in build order: `- [ ] 3. <title>`, then indented lines for
  - what to build and which files;
  - `Requirements: R2.1, R2.3, P1`;
  - `Done when:` the exact test command, green.
- Small tasks: one sitting, a reviewable diff. Tests are written in the same task as the code, or
  before it.
- The first task sets up whatever harness the rest need. The last task re-checks every acceptance
  criterion and updates the `Status` column in `docs/feature-coverage.md`.
- End with a coverage check: every requirement id appears in at least one task.

## Executing tasks (after tasks.md is approved)

- One task at a time, in order. Run the whole test suite before ticking `[x]`.
- After each task, report what changed and the test output, then stop for review.
- If a task cannot be done as written, stop and propose a change to tasks.md (or design.md).
