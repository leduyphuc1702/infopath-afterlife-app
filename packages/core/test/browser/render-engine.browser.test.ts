import { commands } from 'vitest/browser';
import { expect, test } from 'vitest';
import type { EngineReply } from './render-engine.worker';
import { runWorker } from './run-worker';

// Spec 03 task 1 (R1.4, design §5.2): the adapter, xsltjs and xpath run in a dedicated Worker,
// served by Vite with xsltjs's fs/path mapped to core's stubs, and also bundle with every other
// Node built-in refused.

const xsl =
  '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">' +
  '<xsl:output method="html"/><xsl:template match="/"><p id="{generate-id(/r)}">' +
  '<xsl:value-of select="count(//a)"/>|<xsl:value-of select="count(document(\'http://h.example/x.xml\')/*)"/>' +
  '</p><br/></xsl:template></xsl:stylesheet>';

test('the engine adapter renders in a dedicated Worker', async () => {
  const reply = await runWorker<EngineReply>(
    new URL('./render-engine.worker.ts', import.meta.url),
    {
      xsl,
      xml: '<r><a/><a/></r>',
    },
  );
  expect(reply).toEqual({ html: '<p id="d1n">2|0</p><br>' });
});

test('the Worker entry bundles with only xsltjs fs/path mapped to the stubs', async () => {
  const result = await commands.buildWorkerBundle('test/browser/render-engine.worker.ts');
  expect(result.error).toBeUndefined();
  expect(result.ok).toBe(true);
  expect(result.modules).toEqual(
    expect.arrayContaining([
      'node_modules/xsltjs',
      'node_modules/xpath',
      'node_modules/@xmldom/xmldom',
      'src/render/engine/stubs/fs.ts',
      'src/render/engine/stubs/path.ts',
    ]),
  );
});
