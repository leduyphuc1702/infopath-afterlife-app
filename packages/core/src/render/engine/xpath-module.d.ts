// Type-checking stand-in for `xpath` 0.0.36 in src (tsconfig.json `paths`). Its own typings start
// with `/// <reference lib="dom" />`, which clashes with the WebWorker lib core is checked against.
// The adapter types the members it uses itself (xsltjs.ts, XPathInternals).
declare const xpath: Record<string, unknown>;
export default xpath;
