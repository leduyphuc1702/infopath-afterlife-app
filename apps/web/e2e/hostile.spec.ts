import fc from 'fast-check';
import { writeCabinet } from '../../../packages/core/test/helpers/cab-writer';
import { manifestBytes } from '../../../packages/core/test/helpers/synthetic-manifest';
import {
  p5Input,
  recordXml,
  viewXsl,
  type P5Input,
} from '../../../packages/core/test/browser/p5-inputs';
import { expect, test } from './fixtures';
import { pick } from './files';

// Spec 09 R8.3: 20 seeded inputs of property P5 (spec 03's hostile view XSL and records), each
// packed as a real .xsn with core's test-only cabinet writer, are dropped with a record. Every
// template is rendered empty and with its record. No script from them runs (the canary counts
// every read of `alert`, `confirm`, `prompt`, `print` and `open`), no dialog opens, no request is
// made after the page is ready, and no CSP violation is raised (also the fixture's guards).

const SEED = 20261111;
const RUNS = 20;
const inputs = fc.sample(p5Input, { seed: SEED, numRuns: RUNS });
const enc = new TextEncoder();
const SCHEMA =
  '<xsd:schema targetNamespace="urn:my" xmlns:xsd="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">' +
  '<xsd:element name="r"/></xsd:schema>';

const urnOf = (n: string) =>
  `urn:schemas-microsoft-com:office:infopath:Hostile-${n}:-myXSD-2026-11-11T00-00-00`;

/** The record, with the PI that names its template. */
const record = (input: P5Input, n: string) =>
  recordXml(input).replace(
    '?>',
    `?><?mso-infoPathSolution name="${urnOf(n)}" solutionVersion="1.0.0.1" productVersion="15.0.0" PIVersion="1.0.0.0"?>`,
  );

/** A .xsn whose view is the hostile XSL and whose empty form is the hostile record. */
function xsn(input: P5Input, n: string): Buffer {
  const manifest = manifestBytes(
    '<xsf:package><xsf:files><xsf:file name="schema.xsd"/><xsf:file name="view1.xsl"/>' +
      '<xsf:file name="template.xml"/></xsf:files></xsf:package>' +
      '<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:my schema.xsd"/></xsf:documentSchemas>' +
      '<xsf:views default="V"><xsf:view name="V"><xsf:mainpane transform="view1.xsl"/></xsf:view></xsf:views>' +
      '<xsf:fileNew><xsf:initialXmlDocument href="template.xml"/></xsf:fileNew>',
    `solutionFormatVersion="3.0.0.0" name="${urnOf(n)}" solutionVersion="1.0.0.1"`,
  );
  const { bytes } = writeCabinet([
    { name: 'manifest.xsf', bytes: manifest },
    { name: 'schema.xsd', bytes: enc.encode(SCHEMA) },
    { name: 'view1.xsl', bytes: enc.encode(viewXsl(input)) },
    { name: 'template.xml', bytes: enc.encode(record(input, n)) },
  ]);
  return Buffer.from(bytes);
}

test.setTimeout(120_000);

test(`${RUNS} hostile templates and records: no script, dialog, request or violation`, async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __aflCanary: number };
    w.__aflCanary = 0;
    for (const k of ['alert', 'confirm', 'prompt', 'print', 'open']) {
      const orig = w[k];
      Object.defineProperty(window, k, {
        configurable: true,
        get() {
          w.__aflCanary++;
          return orig;
        },
      });
    }
  });
  let dialogs = 0;
  page.on('dialog', (d) => {
    dialogs++;
    void d.dismiss();
  });
  await page.goto('./');
  await expect(page.locator('html[data-ready]')).toHaveCount(1);
  // Calibration: a script that runs is seen by both the canary and the dialog count.
  const canaryNow = () =>
    page.evaluate(() => (window as unknown as { __aflCanary: number }).__aflCanary);
  await page.evaluate(() => alert('calibration'));
  expect([await canaryNow(), dialogs]).toEqual([1, 1]);
  await page.evaluate(() => ((window as unknown as { __aflCanary: number }).__aflCanary = 0));
  dialogs = 0;
  const requests: string[] = [];
  context.on('request', (r) => requests.push(r.url()));

  const outcome = { opened: 0, refused: 0, rendered: 0, renderFailed: 0 };
  const why: string[] = [];
  for (const [i, input] of inputs.entries()) {
    const n = String(i + 1).padStart(2, '0');
    const name = `hostile-${n}`;
    await pick(page, [
      { name: `${name}.xsn`, mimeType: 'application/octet-stream', buffer: xsn(input, n) },
      { name: `${name}-001.xml`, mimeType: 'text/xml', buffer: Buffer.from(record(input, n)) },
    ]);
    const opened = page.locator('.afl-form-name', { hasText: `Hostile-${n}` });
    const refused = page.getByRole('alert').filter({ hasText: `${name}.xsn` });
    await expect(opened.or(refused).first()).toBeVisible();
    // A file that does not open adds no template; a view that fails to render still opens it.
    if ((await opened.count()) === 0) {
      outcome.refused++;
      why.push(`${name}: ${await refused.first().textContent()}`);
      continue;
    }
    outcome.opened++;
    // The empty form (the hostile template.xml), then the record.
    for (const which of ['empty form', `${name}-001.xml`]) {
      if (which !== 'empty form') await page.getByRole('button', { name: 'Next' }).click();
      const paper = page
        .getByRole('region', { name: `Hostile-${n}, V view, ${which}` })
        .locator('.afl-root');
      const failed = page.getByRole('alert').filter({ hasText: `${name}.xsn` });
      await expect(paper.or(failed).first()).toBeAttached();
      if (await failed.count()) {
        outcome.renderFailed++;
        why.push(`${name} ${which}: ${await failed.first().textContent()}`);
      } else outcome.rendered++;
    }
  }

  const canary = await canaryNow();
  const violations = await page.evaluate(() => window.__aflViolations.length);
  console.log(
    `R8.3: seed ${SEED}, ${RUNS} inputs: ${JSON.stringify(outcome)}; canary ${canary}, dialogs ${dialogs}, ` +
      `requests ${requests.length}, violations ${violations}\n${why.join('\n')}`,
  );
  expect({ canary, dialogs, requests, violations }).toEqual({
    canary: 0,
    dialogs: 0,
    requests: [],
    violations: 0,
  });
  expect(outcome.opened + outcome.refused).toBe(RUNS);
  expect(outcome.rendered + outcome.renderFailed).toBe(2 * outcome.opened);
  expect(outcome.rendered).toBeGreaterThan(RUNS);
});
