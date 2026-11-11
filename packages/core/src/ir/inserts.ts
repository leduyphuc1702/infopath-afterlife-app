// Spec 04 task 8 (D18): `IrGroup.insert` from each view's `xsf:xmlToEdit`. Changed in spec 04;
// spec 02's builder calls it last, so no other part of FormIR depends on it.

import type { ParsedTemplate } from '../xsn/parse';
import { loc } from './ids';
import type { IrGroup, IrInsert } from './types';

const COMPONENTS = new Set<string>(['xCollection', 'xOptional', 'xReplace']);

export function withInserts(t: ParsedTemplate, groups: readonly IrGroup[]): IrGroup[] {
  const byPath = new Map<string, IrInsert>();
  for (const v of t.manifest.views)
    for (const x of v.xmlToEdit) {
      const e = x.editWith;
      const item = x.attrs.item;
      const component = e?.attrs.component;
      const name = x.attrs.name;
      if (!e || !item || !name || !component || !COMPONENTS.has(component) || byPath.has(item))
        continue;
      byPath.set(item, {
        component: component as IrInsert['component'],
        xmlToEdit: name,
        view: v.attrs.name ?? '',
        ...(x.attrs.container === undefined ? {} : { container: x.attrs.container }),
        ...(e.attrs.caption === undefined ? {} : { caption: e.attrs.caption }),
        fragments: e.fragments.map((f) => ({
          ...(f.attrs.innerFragment === undefined ? {} : { innerFragment: f.attrs.innerFragment }),
          xml: f.raw,
        })),
        source: loc(x),
      });
    }
  return groups.map((g) => {
    const insert = g.dataSource === 'main' ? byPath.get(g.path) : undefined;
    return insert ? { ...g, insert } : g;
  });
}
