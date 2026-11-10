// Dedicated module Worker (spec 03 task 5): compiles and runs one stylesheet through the engine
// adapter with the default render limits, and replies with the HTML or the typed error, so the
// browser test can show the depth limit holds on a Worker's stack.
import { AfterlifeError, type ErrorCode } from '../../src/errors';
import { resolveLimits } from '../../src/limits';
import { Budget } from '../../src/render/engine/budget';
import { compileView, engineHtml, runView } from '../../src/render/engine/xsltjs';
import { parseXmlDom, xmlContext } from '../../src/xml/parse';

export interface LimitsReply {
  html?: string;
  error?: { code?: string; details?: unknown; message: string };
}

const enc = new TextEncoder();
onmessage = (event: MessageEvent<{ xsl: string; xml: string }>) => {
  const ctx = xmlContext(resolveLimits());
  compileView({
    view: 'View 1',
    xslFile: 'view1.xsl',
    doc: parseXmlDom(enc.encode(event.data.xsl), 'view1.xsl', ctx).doc,
    file: () => undefined,
    xml: ctx,
  })
    .then((view) => {
      const { fragment } = runView(
        view,
        parseXmlDom(enc.encode(event.data.xml), 'r.xml', ctx).doc,
        {
          functions: new Map(),
          host: { report() {} },
          loadDocument: () => undefined,
          budget: new Budget(),
        },
      );
      return engineHtml(view, fragment);
    })
    .then(
      (html) => postMessage({ html } satisfies LimitsReply),
      (e: unknown) =>
        postMessage({
          error:
            e instanceof AfterlifeError
              ? errorReply(e as AfterlifeError<ErrorCode>)
              : { message: String(e) },
        } satisfies LimitsReply),
    );
};

function errorReply(e: AfterlifeError<ErrorCode>): NonNullable<LimitsReply['error']> {
  return { code: e.code, details: e.details, message: e.message };
}
