import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';
import { xsltjsStub } from '@afterlife/core/host/vite';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['test/**/*.test.ts'],
            exclude: ['test/**/*.browser.test.ts'],
          },
        },
        {
          extends: true,
          // As in core's config: pre-bundle the engine, with xsltjs's `fs` and `path` stubbed.
          optimizeDeps: {
            include: ['@xmldom/xmldom', 'xpath', 'xsltjs', 'react', 'react-dom/client'],
            rolldownOptions: {
              plugins: [
                {
                  name: 'afterlife:xsltjs-stubs-prebundle',
                  resolveId: (source: string, importer: string | undefined) =>
                    xsltjsStub(source, importer) ?? null,
                },
              ],
            },
          },
          test: {
            name: 'browser',
            include: ['test/**/*.browser.test.ts'],
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              screenshotFailures: false,
              instances: [{ browser: 'chromium' }],
            },
          },
        },
      ],
    },
  }),
);
