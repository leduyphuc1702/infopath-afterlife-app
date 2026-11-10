import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { xsltjsStubs } from '@afterlife/core/host/vite';
import { csp } from './plugins/csp.ts';
import { notices } from './plugins/notices.ts';
import { samples } from './plugins/samples.ts';

// Spec 09 design §8. `base: './'`: the site works from any path. Core runs only in the Worker;
// the stub plugin is in the main list too, because the dev server and Vitest serve the Worker's
// modules through it.
// One notices collector for both builds (plugins/notices.ts).
const licences = notices();

export default defineConfig({
  base: './',
  plugins: [react(), xsltjsStubs(), samples(), csp(), licences.write],
  worker: { format: 'es', plugins: () => [xsltjsStubs(), samples(), licences.collect] },
  build: { manifest: true, target: 'es2023' },
});
