// Builds a Worker entry with Vite, as an app would bundle core, and fails on any Node built-in
// (task 24, R17.1). Runs in the Node test process through a browser command (vitest.config.ts).
//
// In a browser build Vite would replace `node:fs` with an empty stub and only warn, and its dev
// server would fail only when the stub is used. The guard plugin turns every Node built-in
// import into a build error instead, so a build failure is the check.

import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build, type Plugin, type Rolldown } from 'vite';
import { xsltjsStubs } from '../../host/vite';

const coreRoot = fileURLToPath(new URL('../../', import.meta.url));
/** An entry that imports `node:fs`; the browser test uses this literal to show the guard fails. */
const PROBE = 'virtual:node-import-probe';

export interface WorkerBundleResult {
  ok: boolean;
  /** The build error, when `ok` is false. */
  error?: string;
  /** Bundled module ids, relative to packages/core (dependencies as `node_modules/<name>`). */
  modules: string[];
  bytes: number;
}

/**
 * `entry`: a path relative to packages/core, or `PROBE`, an entry that imports `node:fs` and is
 * expected to fail, so the guard is shown to work.
 */
export async function buildWorkerBundle(entry: string): Promise<WorkerBundleResult> {
  try {
    const out = (await build({
      configFile: false,
      root: coreRoot,
      logLevel: 'silent',
      // Spec 03 §5.2: xsltjs's `fs` and `path` resolve to core's stubs before the guard runs.
      plugins: [xsltjsStubs(), rejectNodeBuiltins(), probe()],
      build: {
        write: false,
        minify: false,
        target: 'es2023',
        rolldownOptions: { input: entry === PROBE ? PROBE : `${coreRoot}${entry}` },
      },
    })) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[];
    const chunks = (Array.isArray(out) ? out : [out])
      .flatMap((o) => o.output)
      .filter((c): c is Rolldown.OutputChunk => c.type === 'chunk');
    const code = chunks.map((c) => c.code).join('\n');
    if (code.includes('__vite-browser-external')) {
      return { ok: false, error: 'bundle holds a browser-external stub', modules: [], bytes: 0 };
    }
    return {
      ok: true,
      modules: [...new Set(chunks.flatMap((c) => c.moduleIds.map(relative)))].sort(),
      bytes: new TextEncoder().encode(code).byteLength,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), modules: [], bytes: 0 };
  }
}

function rejectNodeBuiltins(): Plugin {
  const builtins = new Set(builtinModules);
  return {
    name: 'afterlife:reject-node-builtins',
    enforce: 'pre',
    resolveId(source, importer) {
      const bare = source.startsWith('node:') ? source.slice('node:'.length) : source;
      if (source.startsWith('node:') || builtins.has(bare.split('/')[0]!)) {
        this.error(`Node built-in "${source}" imported by ${importer ?? 'the entry'} (R17.1)`);
      }
      return null;
    },
  };
}

function probe(): Plugin {
  return {
    name: 'afterlife:node-import-probe',
    resolveId: (id) => (id === PROBE ? `\0${PROBE}` : null),
    load: (id) =>
      id === `\0${PROBE}`
        ? `import { readFileSync } from 'node:fs'; postMessage(String(readFileSync));`
        : null,
  };
}

function relative(id: string): string {
  const nm = id.lastIndexOf('/node_modules/');
  if (nm >= 0) {
    const rest = id.slice(nm + '/node_modules/'.length).split('/');
    return `node_modules/${rest[0]!.startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]}`;
  }
  return id.startsWith(coreRoot) ? id.slice(coreRoot.length) : id;
}
