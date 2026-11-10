import { existsSync, readdirSync, readFileSync } from 'node:fs';

// The build the `dist` tests read: `pnpm --filter web test` builds first (package.json).
export const DIST = new URL('../dist/', import.meta.url);
export const distFile = (rel: string) => new URL(rel, DIST);
export const readDist = (rel: string) => readFileSync(distFile(rel));
export const distAssets = () => readdirSync(distFile('assets/')).sort();
if (!existsSync(distFile('index.html')))
  throw new Error('no apps/web/dist: run `pnpm --filter web build` first');
