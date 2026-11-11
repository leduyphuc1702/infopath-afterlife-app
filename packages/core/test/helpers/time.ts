// Spec 19 T1: time limits for tests that run hundreds of cases or megabytes of data. Each takes
// 2.6–3.3 s alone on our machine; the limit leaves room for a machine about ten times slower,
// or one that is busy. Budgets that measure speed are not limits like these: see render-perf.
export const HEAVY_MS = 30_000;
