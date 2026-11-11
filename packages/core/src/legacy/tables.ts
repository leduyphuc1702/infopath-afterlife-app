// Spec 09 R12.1–R12.3, design §11: filled-in records as tables. Sheet `Records` has one row per
// record: file name, template version, then one column per non-repeating field of the main data
// source. Each repeating group (or repeating field) has its own sheet, one row per item, keyed by
// record file name and row number, with the parent's row when it sits in another repeating group.
// Headers are the InfoPath field paths. Values: numbers as number cells, booleans as TRUE/FALSE,
// rich text as its plain text, dates and times as written; base64 files become paths of files
// returned beside the tables.
import type { FormIR, IrField, IrGroup } from '../ir/types';
import { resolveLimits } from '../limits';
import type { XmlElement } from '../xml/node';
import { parseXml, xmlContext } from '../xml/parse';
import { solutionAttribute } from '../xsn/package';
import { embedded, safeSegment } from './attachment';

/** A number cell keeps the text InfoPath wrote, so no digit is lost. */
export interface NumberCell {
  readonly number: string;
}
export type Cell = string | NumberCell;

export interface Sheet {
  readonly name: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly Cell[])[];
}

export interface RecordFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface ExtractedFile {
  /** `attachments/<record>/<field>/<file>`, each segment made safe. */
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface RecordTables {
  readonly sheets: readonly Sheet[];
  readonly files: readonly ExtractedFile[];
  /** Records that could not be read, with the reason; each still has its row. */
  readonly unread: readonly { readonly fileName: string; readonly reason: string }[];
}

export const RECORD_COLUMNS = ['Record file', 'Template version'] as const;

const NUMERIC = new Set(
  'decimal double float integer int long short byte nonNegativeInteger positiveInteger negativeInteger nonPositiveInteger unsignedLong unsignedInt unsignedShort unsignedByte'
    .split(' ')
    .map((t) => `xsd:${t}`),
);
const NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const BLOCK = new Set(['p', 'div', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

type Node = IrField | IrGroup;
const local = (n: Node) => n.name.slice(n.name.indexOf(':') + 1);

/** The text of rich text: every descendant's text, a line break after block elements. */
export function plainText(el: XmlElement): string {
  const out: string[] = [];
  const walk = (e: XmlElement) => {
    for (const c of e.children) {
      if (c.kind === 'text') out.push(c.text);
      else {
        walk(c);
        if (BLOCK.has(c.localName.toLowerCase())) out.push('\n');
      }
    }
  };
  walk(el);
  return out.join('').replace(/\n+$/, '');
}

interface SheetBuild {
  readonly name: string;
  readonly columns: string[];
  readonly rows: Cell[][];
  readonly fixed: number;
  /** The rows of the current record so far: the next row's number. */
  count: number;
}

export function recordTables(
  ir: FormIR,
  records: readonly RecordFile[],
  progress?: (index: number, total: number, fileName: string) => void,
): RecordTables {
  const nodes: Node[] = [...ir.groups, ...ir.fields].filter((n) => n.dataSource === 'main');
  const children = new Map<string | undefined, Node[]>();
  for (const n of nodes) children.set(n.groupId, [...(children.get(n.groupId) ?? []), n]);
  const root = (children.get(undefined) ?? []).find((n): n is IrGroup => n.kind === 'group');

  // Sheets and columns, from the IR alone, in IR order.
  const used = new Set<string>();
  const sheetName = (base: string) => {
    const clean = base.replace(/[[\]:*?/\\]/g, '_').slice(0, 28) || 'Sheet';
    let name = clean;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${clean.slice(0, 27)}${i}`;
    used.add(name.toLowerCase());
    return name;
  };
  const make = (name: string, fixed: string[]): SheetBuild => ({
    name: sheetName(name),
    columns: fixed,
    rows: [],
    fixed: fixed.length,
    count: 0,
  });
  const main = make('Records', [...RECORD_COLUMNS]);
  const sheets: SheetBuild[] = [main];
  const sheetOf = new Map<string, SheetBuild>();
  const columnOf = new Map<string, number>();
  const plan = (g: IrGroup, sheet: SheetBuild, nested: boolean) => {
    for (const c of children.get(g.id) ?? []) {
      if (c.repeating) {
        const s = make(local(c), ['Record file', 'Row', ...(nested ? ['Parent row'] : [])]);
        sheets.push(s);
        sheetOf.set(c.id, s);
        if (c.kind === 'group') plan(c, s, true);
        else {
          columnOf.set(c.id, s.columns.length);
          s.columns.push(c.path);
        }
      } else if (c.kind === 'group') plan(c, sheet, nested);
      else {
        columnOf.set(c.id, sheet.columns.length);
        sheet.columns.push(c.path);
      }
    }
  };
  if (root) plan(root, main, false);

  const files: ExtractedFile[] = [];
  const paths = new Set<string>();
  const unread: { fileName: string; reason: string }[] = [];
  const limits = resolveLimits();

  for (const [n, record] of records.entries()) {
    progress?.(n + 1, records.length, record.fileName);
    const base = safeSegment(record.fileName.replace(/\.xml$/i, ''));
    const pictures = new Map<string, number>();
    for (const s of sheets) s.count = 0;
    const row = (s: SheetBuild, parent?: number): Cell[] => {
      const r: Cell[] = Array<Cell>(s.columns.length).fill('');
      r[0] = record.fileName;
      if (s !== main) {
        r[1] = { number: String(++s.count) };
        if (s.fixed === 3) r[2] = parent === undefined ? '' : { number: String(parent) };
      }
      s.rows.push(r);
      return r;
    };
    const top = row(main);
    top[1] = solutionAttribute(record.bytes, 'solutionVersion') ?? '';

    const fileCell = (f: IrField, text: string): string => {
      const e = embedded(text);
      if (!e) return text.trim();
      const folder = `attachments/${base}/${safeSegment(local(f))}`;
      let name: string;
      if (e.kind === 'attachment') name = safeSegment(e.fileName);
      else {
        const n = (pictures.get(f.id) ?? 0) + 1;
        pictures.set(f.id, n);
        name = e.kind === 'picture' ? `picture-${n}.${e.ext}` : `file-${n}.bin`;
      }
      let path = `${folder}/${name}`;
      const dot = name.lastIndexOf('.');
      for (let i = 2; paths.has(path.toLowerCase()); i++)
        path = `${folder}/${dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`}`;
      paths.add(path.toLowerCase());
      files.push({ path, bytes: e.bytes });
      return path;
    };
    const value = (f: IrField, el: XmlElement | undefined, attr: string | undefined): Cell => {
      if (
        el?.attributes.some(
          (a) => a.namespaceURI === XSI && a.localName === 'nil' && a.value === 'true',
        )
      )
        return '';
      if (f.kind === 'richText') return el ? plainText(el) : '';
      const text = attr ?? el?.textContent() ?? '';
      const type = f.xsdType.builtin;
      if (type === 'xsd:base64Binary') return fileCell(f, text);
      const t = text.trim();
      if (type !== undefined && NUMERIC.has(type) && NUMBER.test(t)) return { number: t };
      if (type === 'xsd:boolean')
        return t === 'true' || t === '1' ? 'TRUE' : t === 'false' || t === '0' ? 'FALSE' : t;
      return text;
    };
    const matches = (el: XmlElement, n: Node): XmlElement[] =>
      el.children.filter(
        (c): c is XmlElement =>
          c.kind === 'element' &&
          c.localName === local(n) &&
          (c.namespaceURI ?? null) === (n.namespace || null),
      );
    const fill = (
      el: XmlElement | undefined,
      g: IrGroup,
      cells: Cell[],
      rowNo: number | undefined,
    ) => {
      for (const c of children.get(g.id) ?? []) {
        if (c.nodeType === 'attribute') {
          if (c.kind === 'group') continue;
          const a = el?.attributes.find(
            (x) => x.localName === local(c) && (x.namespaceURI ?? null) === (c.namespace || null),
          );
          const i = columnOf.get(c.id);
          if (i !== undefined && !c.repeating) cells[i] = a ? value(c, undefined, a.value) : '';
          continue;
        }
        const found = el ? matches(el, c) : [];
        if (c.repeating) {
          const s = sheetOf.get(c.id)!;
          for (const m of found) {
            const r = row(s, rowNo);
            const n = (r[1] as NumberCell).number;
            if (c.kind === 'group') fill(m, c, r, Number(n));
            else r[columnOf.get(c.id)!] = value(c, m, undefined);
          }
        } else if (c.kind === 'group') fill(found[0], c, cells, rowNo);
        else cells[columnOf.get(c.id)!] = found[0] ? value(c, found[0], undefined) : '';
      }
    };

    try {
      const { root: el } = parseXml(record.bytes, record.fileName, xmlContext(limits));
      if (
        root &&
        el.localName === local(root) &&
        (el.namespaceURI ?? null) === (root.namespace || null)
      )
        fill(el, root, top, undefined);
      else unread.push({ fileName: record.fileName, reason: 'its root element is not this form' });
    } catch (e) {
      unread.push({
        fileName: record.fileName,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    sheets: sheets.map(({ name, columns, rows }) => ({ name, columns, rows })),
    files,
    unread,
  };
}
