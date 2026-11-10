import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { DOMImplementation } from '@xmldom/xmldom';
import xpath from 'xpath';
import xsltjsModule from 'xsltjs';
import functionsModule from 'xsltjs/scripts/Functions.js';
import processorModule from 'xsltjs/scripts/Processor.js';
import serializerModule from 'xsltjs/scripts/Serializer.js';
import { expect, test, vi } from 'vitest';
import { Budget } from '../../src/render/engine/budget';
import { applyStepWrappers, runView, XPath } from '../../src/render/engine/xsltjs';
import { compileText, dom, runCompiled } from '../helpers/engine';

// Spec 03 design §5.3 and §11 (guard row): every xsltjs internal the adapter relies on exists
// with the arity read on 1.0.0, xsltjs shares core's xmldom and xpath, and the applyStep wrapper
// is installed exactly once. A version bump that moves any of this fails here.

const MOVED = 'xsltjs internals moved: re-read design §5.3';
const coreRequire = createRequire(new URL('../../package.json', import.meta.url));
const xsltjsDir = realpathSync(coreRequire.resolve('xsltjs/package.json')).replace(
  /package\.json$/,
  '',
);
const xsltjsRequire = createRequire(`${xsltjsDir}package.json`);

type Members = Readonly<Record<string, number>>;
/** Member → arity (`Function.length`), as read on xsltjs 1.0.0 and xpath 0.0.36. */
export const EXPECTED: Readonly<Record<string, Members>> = {
  'Processor.prototype': {
    transform: 1,
    invokeTemplate: 4,
    builtInRule: 4,
    executeInstruction: 2,
    literalResultElement: 2,
    appendText: 2,
    appendNode: 2,
    setAttribute: 5,
    copyNode: 3,
    compile: 2,
    evaluate: 3,
  },
  'Functions.prototype': { find: 2, isAvailable: 2 },
  'Serializer.prototype': { serialize: 1 },
  XSLT: { compile: 1 },
  'xpath.PathExpr': { applyStep: 3 },
};

/** Every mismatch between `actual` objects and EXPECTED, as `owner.member: reason`. */
export function internalsProblems(actual: Readonly<Record<string, unknown>>): string[] {
  const problems: string[] = [];
  for (const [owner, members] of Object.entries(EXPECTED)) {
    const obj = actual[owner] as Record<string, unknown> | undefined;
    for (const [name, arity] of Object.entries(members)) {
      const f = obj?.[name];
      if (typeof f !== 'function') problems.push(`${owner}.${name}: missing`);
      else if (f.length !== arity)
        problems.push(`${owner}.${name}: arity ${f.length}, expected ${arity}`);
    }
  }
  return problems;
}

const Processor = processorModule.Processor as { prototype: object; MAX_DEPTH: number };
const Functions = functionsModule.Functions as { prototype: object };
const Serializer = serializerModule.Serializer as { prototype: object };
const actual = {
  'Processor.prototype': Processor.prototype,
  'Functions.prototype': Functions.prototype,
  'Serializer.prototype': Serializer.prototype,
  XSLT: xsltjsModule.XSLT,
  'xpath.PathExpr': (xpath as unknown as { PathExpr: object }).PathExpr,
};

test('xsltjs is 1.0.0, and xpath is 0.0.36', () => {
  expect(coreRequire('xsltjs/package.json')).toMatchObject({ version: '1.0.0' });
  expect(coreRequire('xpath/package.json')).toMatchObject({ version: '0.0.36' });
});

test('every internal the adapter uses exists with its 1.0.0 arity', () => {
  expect(internalsProblems(actual), MOVED).toEqual([]);
  expect(Processor.MAX_DEPTH, MOVED).toBe(3000);
});

test('the guard fails on a renamed method', () => {
  const { invokeTemplate, ...renamed } = Object.getOwnPropertyDescriptors(Processor.prototype);
  void invokeTemplate;
  const moved = { ...actual, 'Processor.prototype': Object.defineProperties({}, renamed) };
  expect(internalsProblems(moved)).toEqual(['Processor.prototype.invokeTemplate: missing']);
});

test('xsltjs resolves the same @xmldom/xmldom and xpath files as core (workspace overrides)', () => {
  for (const name of ['@xmldom/xmldom', 'xpath']) {
    expect(realpathSync(xsltjsRequire.resolve(name)), name).toBe(
      realpathSync(coreRequire.resolve(name)),
    );
  }
});

test('at run time xsltjs uses the same xpath module and xmldom classes as core', async () => {
  let seen: unknown;
  const XSLT = xsltjsModule.XSLT as {
    process(i: string, t: string, p: object, o: object): Promise<string>;
  };
  await XSLT.process(
    '<r/>',
    '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:t="urn:t">' +
      '<xsl:template match="/"><xsl:value-of select="t:probe()"/></xsl:template></xsl:stylesheet>',
    {},
    {
      customFunctions: {
        'urn:t': {
          probe(this: { XPath: unknown }) {
            seen = this.XPath;
            return '';
          },
        },
      },
    },
  );
  expect(seen).toBe(xpath);
  expect(XPath).toBe(xpath);

  const view = await compileText(
    '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"><p/></xsl:template></xsl:stylesheet>',
  );
  const { fragment } = runView(view, dom('<r/>'), {
    functions: new Map(),
    host: { report() {} },
    loadDocument: () => undefined,
    budget: new Budget(),
  });
  const coreDocument = new DOMImplementation().createDocument(null, 'x');
  expect((fragment as unknown as { ownerDocument: object }).ownerDocument.constructor).toBe(
    coreDocument.constructor,
  );
});

test('applyStep is wrapped exactly once, also after the adapter is loaded again', async () => {
  expect(applyStepWrappers()).toBe(1);
  vi.resetModules();
  const again = await import('../../src/render/engine/xsltjs');
  expect(again.XPath).toBe(XPath);
  expect(again.applyStepWrappers()).toBe(1);
});

test('a probe view shows each task 1 hook firing', async () => {
  const view = await compileText(
    '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:ipApp="http://schemas.microsoft.com/office/infopath/2006/XPathExtension/ipApp" exclude-result-prefixes="ipApp">' +
      '<xsl:output method="html"/><xsl:template match="/"><p>' +
      "<xsl:value-of select=\"concat(function-available('concat'), function-available('replace'), function-available('ipApp:GetMajorVersion'))\"/>|" +
      '<xsl:value-of select="ipApp:GetMajorVersion()"/>|<xsl:value-of select="ipApp:GetMajorVersion()"/>|' +
      '<xsl:value-of select="string-length(concat(/r/a, /r/a))"/>' +
      '</p></xsl:template></xsl:stylesheet>',
  );
  const out = runCompiled(view, `<r><a>${'x'.repeat(160)}</a></r>`);
  // concat(…) ×2 → "truefalsefalse"; unknown → ''; 320 characters.
  expect(out.html).toBe('<p>truefalsefalse|||320</p>');
  expect(out.issues.map((i) => [i.code, i.details])).toEqual([
    ['UNKNOWN_FUNCTION', { name: 'ipApp:GetMajorVersion', calls: 2 }],
  ]);
  // applyStep: /r/a twice (2 steps × (1 + 1 node)); strings: 14 chars → 1, 320 chars → 20;
  // instructions (task 5): p and four value-of.
  expect(out.budget.steps).toBe(2 * 2 * 2 + 1 + 20 + 5);
});
