// The virtual modules of plugins/samples.ts.
declare module 'virtual:sample-list' {
  const list: readonly { id: string; fileName: string; records: number }[];
  export default list;
}
declare module 'virtual:sample-files' {
  /** `[file name, content, 't' (text, UTF-8) | 'b' (base64)]`. */
  type Encoded = readonly [string, string, 't' | 'b'];
  const files: Readonly<
    Record<string, { readonly template: Encoded; readonly records: readonly Encoded[] }>
  >;
  export default files;
}
