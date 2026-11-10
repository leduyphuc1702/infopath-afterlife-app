import { defineConfig } from '@playwright/test';

// Spec 09 design §9: every e2e test runs against the built `dist`, served under a sub-path, so
// `base: './'` is tested as a static host would serve it.
const PORT = 4319;
export const BASE_URL = `http://localhost:${PORT}/infopath-afterlife-app/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: BASE_URL, browserName: 'chromium', viewport: { width: 1280, height: 800 } },
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --base /infopath-afterlife-app/ --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
