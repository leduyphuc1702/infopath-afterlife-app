// Custom browser commands defined in packages/core/vitest.config.ts. They run in Node.
import type { SampleCabinet } from '../helpers/samples';
import type { WorkerBundleResult } from '../helpers/worker-bundle';

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** SHA-256 (hex) of the zlib-dictionary oracle's folder output for the cabinet at `path`. */
    zlibOracleSha256: (path: string) => Promise<string>;
    /** Every WHATWG label → Node's canonical `TextDecoder#encoding`, or `null` if rejected. */
    nodeAcceptedLabels: () => Promise<Record<string, string | null>>;
    /** The 48 in-repo cabinets, as listed by test/helpers/samples.ts. */
    sampleCabinets: () => Promise<SampleCabinet[]>;
    /** Vite build of a Worker entry with Node built-ins refused (test/helpers/worker-bundle.ts). */
    buildWorkerBundle: (entry: string) => Promise<WorkerBundleResult>;
  }
}
