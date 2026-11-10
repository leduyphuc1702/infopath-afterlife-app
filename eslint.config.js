import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// R17.1, R17.4: core runs unchanged in Node 22, a Web Worker and a Forge function, so its
// source may not touch Node modules, the network or the DOM. Design §12.
const restrictedModules = [
  { name: 'fs', message: 'core has no file system access (R17.1).' },
  { name: 'path', message: 'core has no Node-only imports (R17.1).' },
  { name: 'zlib', message: 'core inflates with DecompressionStream; zlib is a test oracle (D1).' },
  { name: 'crypto', message: 'core has no Node-only imports (R17.1).' },
];
const xmldomOutsideParser = {
  name: '@xmldom/xmldom',
  message: 'Only packages/core/src/xml/parse.ts imports @xmldom/xmldom (design §7.2).',
};
const nodeBuiltins = {
  group: ['node:*'],
  message: 'core has no Node-only imports (R17.1).',
};
// Spec 03 D1: one adapter owns the XSLT engine and its XPath library.
const engineOutsideAdapter = {
  // A regex, not a gitignore-style group: `xpath` must not match core's own `./xpath/` folder.
  regex: '^(xsltjs(/.*)?|xpath)$',
  message: 'Only packages/core/src/render/engine/xsltjs.ts imports xsltjs or xpath (spec 03 D1).',
};
const restrictedGlobals = [
  ['fetch', 'core makes no network requests (R17.4).'],
  ['XMLHttpRequest', 'core makes no network requests (R17.4).'],
  ['DOMParser', 'DOMParser does not exist in Web Workers; use src/xml/ (tech.md).'],
  ['document', 'core has no DOM (R17.1).'],
  ['window', 'core has no DOM (R17.1).'],
  ['process', 'core has no Node-only globals (R17.1).'],
  ['Buffer', 'core has no Node-only globals; use Uint8Array (R17.1).'],
  ['require', 'core is ESM only (R17.1).'],
  ['XSLTProcessor', 'Chrome is removing XSLT; core brings its own engine (spec 03 R3.4).'],
].map(([name, message]) => ({ name, message }));

export default defineConfig(
  {
    ignores: [
      '**/node_modules/',
      'coverage/',
      'test-results/',
      'samples/',
      'docs/',
      '.kiro/',
      'apps/web/dist/',
      'apps/web/playwright-report/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './packages/core/tsconfig.json',
          './packages/core/test/tsconfig.json',
          './apps/web/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...restrictedModules, xmldomOutsideParser],
          patterns: [nodeBuiltins, engineOutsideAdapter],
        },
      ],
      'no-restricted-globals': ['error', ...restrictedGlobals],
    },
  },
  {
    // Spec 02 R1.1 and spec 03 R1.4: FormIR and renders depend on their inputs alone, so there is
    // no clock and no randomness; the current date is an input.
    files: [
      'packages/core/src/ir/**/*.ts',
      'packages/core/src/render/**/*.ts',
      'packages/core/src/xpath-fns/**/*.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        ...restrictedGlobals,
        {
          name: 'Date',
          message: 'No clock: the output depends on its inputs (spec 02 R1.1, spec 03 R1.4).',
        },
        {
          name: 'performance',
          message: 'No clock: the output depends on its inputs (spec 02 R1.1, spec 03 R1.4).',
        },
        {
          name: 'crypto',
          message: 'No randomness: the output depends on its inputs (spec 02 R1.1).',
        },
        {
          name: 'Intl',
          message:
            'ICU differs between Node and Chromium; core formats with its own tables (spec 03 D8).',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'No randomness (spec 02 R1.1, spec 03 R7).',
        },
      ],
    },
  },
  {
    files: ['packages/core/src/render/engine/xsltjs.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [...restrictedModules, xmldomOutsideParser], patterns: [nodeBuiltins] },
      ],
    },
  },
  {
    files: ['packages/core/src/xml/parse.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: restrictedModules, patterns: [nodeBuiltins, engineOutsideAdapter] },
      ],
    },
  },
  {
    // Spec 09 design §1: core runs only in the Worker; the main thread imports its types alone,
    // so the main bundle carries neither xsltjs nor xmldom.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/worker/worker.ts', 'apps/web/src/worker/session.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@afterlife/core',
              allowTypeImports: true,
              message: 'Only the Worker runs core (spec 09 design §1); import types only.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
