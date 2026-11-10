// `@atlaskit/tokens` theme modules (design D5): each default-exports its CSS as a string.
declare module '@atlaskit/tokens/dist/esm/artifacts/themes/*.js' {
  const css: string;
  export default css;
}
