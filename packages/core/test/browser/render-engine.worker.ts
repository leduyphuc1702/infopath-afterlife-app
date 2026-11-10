// Dedicated module Worker (spec 03 task 1): compiles and runs one stylesheet through the engine
// adapter, so the browser project shows xsltjs runs in a Worker with core's fs/path stubs.
import { resolveLimits } from '../../src/limits';
import { Budget } from '../../src/render/engine/budget';
import { compileView, engineHtml, runView } from '../../src/render/engine/xsltjs';
import { parseXmlDom, xmlContext } from '../../src/xml/parse';

export interface EngineReply {
  html?: string;
  error?: string;
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
  }).then(
    (view) => {
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
      postMessage({ html: engineHtml(view, fragment) } satisfies EngineReply);
    },
    (e: unknown) => postMessage({ error: String(e) } satisfies EngineReply),
  );
};
