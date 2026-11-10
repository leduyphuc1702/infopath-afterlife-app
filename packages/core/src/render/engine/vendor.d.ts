// The CommonJS modules of xsltjs 1.0.0 that the engine adapter imports, typed loosely here and
// precisely in xsltjs.ts (spec 03 design §5.3). They are CommonJS, so only their default export
// (`module.exports`) is reliable in Node and in bundles.
declare module 'xsltjs' {
  const xsltjs: Record<string, unknown>;
  export default xsltjs;
}
declare module 'xsltjs/scripts/Processor.js' {
  const processor: Record<string, unknown>;
  export default processor;
}
declare module 'xsltjs/scripts/Serializer.js' {
  const serializer: Record<string, unknown>;
  export default serializer;
}
/** Read only by the guard test (test/render/engine-guard.test.ts). */
declare module 'xsltjs/scripts/Functions.js' {
  const functions: Record<string, unknown>;
  export default functions;
}
