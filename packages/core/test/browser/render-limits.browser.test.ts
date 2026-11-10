import { expect, test } from 'vitest';
import type { LimitsReply } from './render-limits.worker';
import { runWorker } from './run-worker';

// Spec 03 task 5 (R3.3, design §6 and §12): the Worker stack holds 128 nested template calls,
// the templateDepth default, and the 129th gives LIMIT_EXCEEDED rather than a stack overflow.
// (Changed at task 5: was 256, which a fresh Chromium Worker cannot reach; design §6.)

/** The root template, then a named template calling itself until `depth` calls are nested. */
const nested = (depth: number) =>
  '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">' +
  '<xsl:output method="html"/><xsl:template match="/">' +
  `<xsl:call-template name="t"><xsl:with-param name="n" select="${depth - 1}"/></xsl:call-template>` +
  '</xsl:template><xsl:template name="t"><xsl:param name="n"/><b>' +
  '<xsl:if test="$n &gt; 1"><xsl:call-template name="t"><xsl:with-param name="n" select="$n - 1"/></xsl:call-template></xsl:if>' +
  '</b></xsl:template></xsl:stylesheet>';

const run = (depth: number) =>
  runWorker<LimitsReply>(new URL('./render-limits.worker.ts', import.meta.url), {
    xsl: nested(depth),
    xml: '<r/>',
  });

test('128 nested templates render in a Chromium Worker', async () => {
  const reply = await run(128);
  expect(reply.error).toBeUndefined();
  // The root template, then 127 calls of t, each writing one b.
  expect(reply.html?.match(/<b>/g)).toHaveLength(127);
});

test('129 give LIMIT_EXCEEDED templateDepth', async () => {
  const reply = await run(129);
  expect(reply.error).toMatchObject({
    code: 'LIMIT_EXCEEDED',
    details: { limit: 'templateDepth', max: 128, observed: 129 },
  });
});
