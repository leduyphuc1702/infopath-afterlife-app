# Spec 27 verification (2026-11-11)

| Test | Before (`68e8173` sources) | After |
|---|---|---|
| reducer: opened again from the start page | fails (`recordIndex` 0) | pass |
| reducer: Back and Forward, record gone | fails | pass |
| reducer: no new entry per record | pass (guard) | pass |
| e2e way 1, way 2, F10 | fails at way 1: "Empty form" for "Record 1 of 20, …" | pass |

The e2e test stops at its first failure, so before the fix way 2 and F10 were not reached;
they are covered before the fix by the reducer tests (way 2) and by spec 22's report (F10).
