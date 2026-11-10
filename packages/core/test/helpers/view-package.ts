// Packages around the synthetic view fixtures (test/fixtures/synthetic/views/): a generated
// manifest with the given views, the shared main schema (`urn:my`, root `my:order`) and the
// secondary source `Depots` (`rows.xsd`, `rows.xml`).

import { readFileSync } from 'node:fs';
import { buildFormIR, parsePackage, type FormIR, type FormIROptions } from '../../src/index';
import type { PackageFile } from '../../src/cab/reader';
import type { ParsedTemplate } from '../../src/xsn/parse';
import { packageFile } from './package';
import { manifestBytes } from './synthetic-manifest';

const root = new URL('../fixtures/synthetic/views/', import.meta.url);
export const viewFixture = (name: string, dir = ''): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`${dir}${name}`, root)));

export interface PackageOptions {
  readonly defaultView?: string;
  /** A sub-folder of the fixture folder, e.g. `labels/`: its own `myschema.xsd`, no `Depots`. */
  readonly dir?: string;
}

export interface FixtureView {
  readonly name: string;
  /** The `mainpane/@transform`; the file is read from the fixture folder unless `missing`. */
  readonly file: string;
  readonly missing?: boolean;
}

export function viewPackage(
  views: readonly FixtureView[],
  { defaultView = views[0]?.name, dir = '' }: PackageOptions = {},
): ParsedTemplate {
  const present = views.filter((v) => !v.missing).map((v) => v.file);
  const secondary = dir === '';
  const listed = [
    ...new Set(['myschema.xsd', ...(secondary ? ['rows.xsd', 'rows.xml'] : []), ...present]),
  ];
  const inner = `
<xsf:package><xsf:files>${listed.map((f) => `<xsf:file name="${f}"/>`).join('')}</xsf:files></xsf:package>
<xsf:documentSchemas><xsf:documentSchema rootSchema="yes" location="urn:my myschema.xsd"/></xsf:documentSchemas>
${secondary ? '<xsf:dataObjects><xsf:dataObject name="Depots" schema="rows.xsd" initOnLoad="yes"><xsf:query><xsf:xmlFileAdapter fileUrl="rows.xml"/></xsf:query></xsf:dataObject></xsf:dataObjects>' : ''}
<xsf:views${defaultView === undefined ? '' : ` default="${defaultView}"`}>${views
    .map(
      (v) =>
        `<xsf:view name="${v.name}" caption="${v.name}"><xsf:mainpane transform="${v.file}"/></xsf:view>`,
    )
    .join('')}</xsf:views>`;
  const files: PackageFile[] = [
    packageFile('manifest.xsf', manifestBytes(inner)),
    ...listed.map((f) => packageFile(f, viewFixture(f, dir))),
  ];
  return parsePackage(files);
}

export function viewIR(
  views: readonly FixtureView[],
  options?: FormIROptions,
  pkg?: PackageOptions,
): { t: ParsedTemplate; ir: FormIR; issues: FormIR['issues'] } {
  const t = viewPackage(views, pkg);
  const ir = buildFormIR(t, options);
  return { t, ir, issues: ir.issues.slice(t.issues.length) };
}
