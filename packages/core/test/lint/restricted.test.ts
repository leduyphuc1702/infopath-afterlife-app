import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';

// R17.1, R17.4: the lint rules in /eslint.config.js keep Node, network and DOM APIs out of
// packages/core/src. The code below is linted in memory as if it lived at those paths.
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

// The in-memory files are not in any tsconfig, so type-aware parsing is switched off here; the
// rules under test are not type-aware.
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfig: [{ files: ['**/*.ts'], ...tseslint.configs.disableTypeChecked }],
});

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId ?? 'fatal');
}

describe('packages/core/src restrictions', () => {
  const file = 'packages/core/src/x.ts';
  const cases: [string, string, string][] = [
    ["import 'node:fs'", "import 'node:fs';\n", 'no-restricted-imports'],
    ["import 'zlib'", "import 'zlib';\n", 'no-restricted-imports'],
    ['fetch(…)', "void fetch('https://example.invalid/');\n", 'no-restricted-globals'],
    ['new DOMParser()', 'export const p = new DOMParser();\n', 'no-restricted-globals'],
    ['Buffer.from(…)', "export const b = Buffer.from('x');\n", 'no-restricted-globals'],
    ["import '@xmldom/xmldom'", "import '@xmldom/xmldom';\n", 'no-restricted-imports'],
  ];

  test.each(cases)('%s is an error', async (_name, code, rule) => {
    expect(await ruleIds(code, file)).toEqual([rule]);
  });

  test('src/xml/parse.ts may import @xmldom/xmldom', async () => {
    expect(await ruleIds("import '@xmldom/xmldom';\n", 'packages/core/src/xml/parse.ts')).toEqual(
      [],
    );
  });

  test('src/xml/parse.ts still may not import node:fs', async () => {
    expect(await ruleIds("import 'node:fs';\n", 'packages/core/src/xml/parse.ts')).toEqual([
      'no-restricted-imports',
    ]);
  });
});

describe('packages/core/src/ir restrictions (spec 02 R1.1)', () => {
  const files = [
    'packages/core/src/ir/x.ts',
    'packages/core/src/ir/views/x.ts',
    'packages/core/src/ir/xpath/x.ts',
  ];
  const cases: [string, string, string][] = [
    ["import 'node:fs'", "import 'node:fs';\n", 'no-restricted-imports'],
    ["import '@xmldom/xmldom'", "import '@xmldom/xmldom';\n", 'no-restricted-imports'],
    ['fetch(…)', "void fetch('https://example.invalid/');\n", 'no-restricted-globals'],
    ['new DOMParser()', 'export const p = new DOMParser();\n', 'no-restricted-globals'],
    ['Date.now()', 'export const d = Date.now();\n', 'no-restricted-globals'],
    ['new Date()', 'export const d = new Date();\n', 'no-restricted-globals'],
    ['performance.now()', 'export const t = performance.now();\n', 'no-restricted-globals'],
    ['crypto.randomUUID()', 'export const u = crypto.randomUUID();\n', 'no-restricted-globals'],
    ['Math.random()', 'export const r = Math.random();\n', 'no-restricted-properties'],
  ];

  test.each(files.flatMap((f) => cases.map(([n, c, r]) => [`${f}: ${n}`, c, r, f] as const)))(
    '%s is an error',
    async (_name, code, rule, file) => {
      expect(await ruleIds(code, file)).toEqual([rule]);
    },
  );

  test('the clock rules apply to src/ir only', async () => {
    expect(await ruleIds('export const d = Date.now();\n', 'packages/core/src/x.ts')).toEqual([]);
  });
});
