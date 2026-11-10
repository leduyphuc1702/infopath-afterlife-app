// Spec 09 D5, `Changed in task 1:` Atlassian design tokens from the theme CSS that
// `@atlaskit/tokens` ships, imported directly. `setGlobalTheme` added 46 KB gzip to the entry
// chunk (measured 2026-11-11: 45.7 → 91.6 KB) and emitted 25 theme chunks; these three themes
// cost about 7 KB. The CSS selects on `<html data-theme data-color-mode>`, which this module sets
// from the system preference and keeps in step with it.
import dark from '@atlaskit/tokens/dist/esm/artifacts/themes/atlassian-dark.js';
import light from '@atlaskit/tokens/dist/esm/artifacts/themes/atlassian-light.js';
import spacing from '@atlaskit/tokens/dist/esm/artifacts/themes/atlassian-spacing.js';

export function startTheme(doc: Document = document): void {
  const style = doc.createElement('style');
  style.dataset.aflTheme = '';
  style.textContent = [light, dark, spacing].join('\n');
  doc.head.append(style);
  const html = doc.documentElement;
  html.dataset.theme = 'light:light dark:dark spacing:spacing';
  const query = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => (html.dataset.colorMode = query.matches ? 'dark' : 'light');
  apply();
  query.addEventListener('change', apply);
}
