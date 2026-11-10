// Stage 6: labels (spec 02 R5, design §6.2). A field is labelled from its first bound control in
// the default view by the first R5.1 step that gives text; groups always use step 8.

import type { Located } from '../../unknown';
import type { FieldNode } from '../../xsd/types';
import type { IrField, IrView, LabelEvidence, LabelSource } from '../types';
import { cellText, headerCell, leftCell, textAround, type Text } from './cells';
import type { ScannedControl } from './scan';

/** Split at `_`, `-`, `.` and lower-to-upper changes; capitalise each word; keep capital runs. */
export function titleCase(name: string): string {
  const words = name
    .split(/[_.-]+/)
    .flatMap((w) => w.split(/(?<=[a-z])(?=[A-Z])/))
    .filter((w) => w !== '');
  return words.length ? words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ') : name;
}

/** R5.2: whitespace collapsed, one trailing colon removed. */
export function cleanLabel(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/:$/, '').trim();
}

type ViewStep = Exclude<LabelSource, 'schemaDisplayName' | 'otherView' | 'name'>;
interface Found {
  readonly label: string;
  readonly step: ViewStep;
  readonly at?: Located;
}

const is = (c: ScannedControl, xctname: string) => c.control.xctname?.toLowerCase() === xctname;
/** Text after these belongs to them (checkbox text, a choice label), never to the next control. */
const OWNS_TEXT_AFTER = ['checkbox', 'optionbutton'];

/** Steps 1–5 on one control; `skipTitle` starts at step 2 (a test cross-check). */
export function inView(c: ScannedControl, skipTitle = false): Found | undefined {
  const where = (t: Text | undefined): Located | undefined =>
    t?.at && { file: c.file, path: t.at.path, line: t.at.line, column: t.at.column };
  const take = (step: ViewStep, t: Text | undefined): Found | undefined => {
    const label = cleanLabel(t?.text ?? '');
    if (label === '') return undefined;
    const at = where(t);
    return { label, step, ...(at === undefined ? {} : { at }) };
  };
  if (!skipTitle && c.control.title !== undefined) {
    const label = cleanLabel(c.control.title);
    if (label !== '') return { label, step: 'title', ...(c.titleAt ? { at: c.titleAt } : {}) };
  }
  const around = textAround(c.element, c.chain);
  const ownedByPrevious =
    around.previous !== undefined && OWNS_TEXT_AFTER.includes(around.previous.toLowerCase());
  const left = leftCell(c.chain);
  return (
    (ownedByPrevious ? undefined : take('cell', around.before)) ??
    take('leftCell', left && cellText(left)) ??
    (is(c, 'checkbox') ? take('checkboxText', around.after) : undefined) ??
    (c.control.inRepeat
      ? take('columnHeader', ((h) => h && cellText(h))(headerCell(c.chain, c.repeatAt)))
      : undefined)
  );
}

export interface LabelInput {
  readonly fields: readonly IrField[];
  readonly views: readonly IrView[];
  readonly controls: readonly ScannedControl[];
  readonly nodeOf: ReadonlyMap<string, FieldNode>;
}

/** The fields with `label`, `labelSource` and `labelEvidence` set (R5.1–R5.3). */
export function labelFields(input: LabelInput): IrField[] {
  const scanned = input.views.filter((v) => v.scanned);
  const def =
    scanned.find((v) => v.isDefault) ??
    (input.views.some((v) => v.isDefault) ? undefined : scanned[0]);
  const others = scanned.filter((v) => v !== def);
  // First control per (view, field), in document order.
  const first = new Map<string, ScannedControl>();
  for (const c of input.controls) {
    const id = c.control.targetId;
    if (id === undefined) continue;
    const key = `${c.view}\u0000${id}`;
    if (!first.has(key)) first.set(key, c);
  }
  const firstIn = (v: IrView, id: string) => first.get(`${v.name}\u0000${id}`);

  return input.fields.map((f): IrField => {
    const set = (label: string, labelEvidence: LabelEvidence): IrField => ({
      ...f,
      label,
      labelSource: labelEvidence.step,
      labelEvidence,
    });
    const own = def && firstIn(def, f.id);
    const found = own && inView(own);
    if (found) {
      return set(found.label, {
        step: found.step,
        view: def.name,
        ...(found.at === undefined ? {} : { at: found.at }),
      });
    }
    const node = input.nodeOf.get(f.id);
    const display = cleanLabel(node?.sharePoint?.displayName ?? '');
    if (display !== '' && node) {
      return set(display, {
        step: 'schemaDisplayName',
        at: {
          file: node.source.file,
          path: node.source.path,
          line: node.source.line,
          column: node.source.column,
        },
      });
    }
    for (const v of others) {
      const c = firstIn(v, f.id);
      const o = c && inView(c);
      if (o) {
        return set(o.label, {
          step: 'otherView',
          viewStep: o.step,
          view: v.name,
          ...(o.at === undefined ? {} : { at: o.at }),
        });
      }
    }
    return set(titleCase(f.name), { step: 'name' });
  });
}
