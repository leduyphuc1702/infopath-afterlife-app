import { playwright } from '@vitest/browser-playwright';
import type { BrowserCommand } from 'vitest/node';
import { defineConfig } from 'vitest/config';
import { WHATWG_LABELS, probeLabels } from './test/helpers/encoding-labels';
import { sampleCabinets } from './test/helpers/samples';
import { buildWorkerBundle } from './test/helpers/worker-bundle';
import { zlibOracleSha256 } from './test/helpers/zlib-oracle';

// Browser commands run in the Node test process, so browser tests can compare with Node
// without zlib or node:fs in the bundle. Types: test/browser/commands.d.ts.
const commands = {
  zlibOracleSha256: ((_ctx, path: string) => zlibOracleSha256(path)) as BrowserCommand<[string]>,
  nodeAcceptedLabels: (() => probeLabels(WHATWG_LABELS.map((l) => l.label))) as BrowserCommand,
  sampleCabinets: (() => sampleCabinets()) as BrowserCommand,
  buildWorkerBundle: ((_ctx, entry: string) => buildWorkerBundle(entry)) as BrowserCommand<
    [string]
  >,
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          exclude: ['test/browser/**', 'test/perf/**', '**/*.browser.test.ts', '**/*.perf.test.ts'],
        },
      },
      {
        // Pre-bundle core's one dependency, so Vite does not discover it mid-run and reload the
        // page (task 24: the first browser test to import src/index.ts).
        optimizeDeps: { include: ['@xmldom/xmldom'] },
        test: {
          name: 'browser',
          include: ['test/browser/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
            commands,
          },
        },
      },
      {
        test: {
          name: 'perf',
          environment: 'node',
          include: ['test/perf/**/*.perf.test.ts'],
          pool: 'forks',
          maxWorkers: 1,
          fileParallelism: false,
          sequence: { concurrent: false },
        },
      },
    ],
  },
});
