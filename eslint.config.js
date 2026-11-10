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
const restrictedGlobals = [
  ['fetch', 'core makes no network requests (R17.4).'],
  ['XMLHttpRequest', 'core makes no network requests (R17.4).'],
  ['DOMParser', 'DOMParser does not exist in Web Workers; use src/xml/ (tech.md).'],
  ['document', 'core has no DOM (R17.1).'],
  ['window', 'core has no DOM (R17.1).'],
  ['process', 'core has no Node-only globals (R17.1).'],
  ['Buffer', 'core has no Node-only globals; use Uint8Array (R17.1).'],
  ['require', 'core is ESM only (R17.1).'],
].map(([name, message]) => ({ name, message }));

export default defineConfig(
  { ignores: ['**/node_modules/', 'coverage/', 'test-results/', 'samples/', 'docs/', '.kiro/'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./packages/core/tsconfig.json', './packages/core/test/tsconfig.json'],
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
        { paths: [...restrictedModules, xmldomOutsideParser], patterns: [nodeBuiltins] },
      ],
      'no-restricted-globals': ['error', ...restrictedGlobals],
    },
  },
  {
    files: ['packages/core/src/xml/parse.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: restrictedModules, patterns: [nodeBuiltins] }],
    },
  },
  prettier,
);
