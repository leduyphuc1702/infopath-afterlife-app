// The InfoPath extension functions a render offers (spec 03 design §7.1, R4.1). Bindings only:
// the value logic is in src/xpath-fns/, and the engine is reached through FnArg and FnHost,
// never directly. One table per render, so its per-render issue sets start empty.

import type { Issue } from '../errors';
import type { FnArg, FnHost, FnImpl, FunctionTable } from './engine/host';
import { imageType } from './html/resources';
import { formatStringResult } from '../xpath-fns/format';
import { average, nowValue, nz, stringCompare, today } from '../xpath-fns/values';

export const NS = {
  xdFormatting: 'http://schemas.microsoft.com/office/infopath/2003/xslt/formatting',
  xdXDocument: 'http://schemas.microsoft.com/office/infopath/2003/xslt/xDocument',
  xdImage: 'http://schemas.microsoft.com/office/infopath/2003/xslt/xImage',
  xdDate: 'http://schemas.microsoft.com/office/infopath/2003/xslt/Date',
  xdMath: 'http://schemas.microsoft.com/office/infopath/2003/xslt/Math',
  xdUser: 'http://schemas.microsoft.com/office/infopath/2006/xslt/User',
  msxsl: 'urn:schemas-microsoft-com:xslt',
} as const;

/** What the functions of one render depend on, besides their arguments. */
export interface FunctionInputs {
  readonly now: string;
  readonly locale: string;
  readonly userName: string;
  /**
   * R2.2: data object name → its package file, for `xmlFileAdapter` sources whose endpoint is
   * `package` (spec 02 R8.3). Any other name is unavailable.
   */
  readonly secondary?: ReadonlyMap<string, string>;
  /** The view file, for issue text. */
  readonly file?: string;
}

const str = (args: readonly FnArg[], i: number) => args[i]?.string() ?? '';
const strings = (arg: FnArg | undefined) => arg?.nodes()?.map((n) => n.string()) ?? [];
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function functionTable(inputs: FunctionInputs): FunctionTable {
  const file = inputs.file ?? '';
  const unavailable = new Set<string>();
  const failed = new Set<string>();
  const formats = new Set<string>();
  const once = (seen: Set<string>, key: string, host: FnHost, issue: () => Issue) => {
    if (seen.has(key)) return;
    seen.add(key);
    host.report(issue());
  };

  /** R4.3: en-US tables; an unknown pattern, or another locale, is reported once per render. */
  const format: FnImpl = (args, host) => {
    const type = str(args, 1);
    const r = formatStringResult(str(args, 0), type, str(args, 2));
    if (r.unsupported) {
      const { option } = r.unsupported;
      once(formats, `f\u0000${type}\u0000${option}`, host, () => ({
        code: 'FORMAT_UNSUPPORTED',
        message: `${file}: formatString ${type} with ${option} is not supported; the value is shown as written`,
        file,
        details: { type, option },
      }));
    }
    for (const locale of [inputs.locale, r.locale]) {
      if (locale === undefined || /^en-us$|^1033$/i.test(locale)) continue;
      once(formats, `l\u0000${locale}`, host, () => ({
        code: 'LOCALE_UNSUPPORTED',
        message: `${file}: locale ${locale} is not supported; formatString used en-US`,
        file,
        details: { locale },
      }));
    }
    return r.text;
  };

  const getDOM: FnImpl = (args, host) => {
    const name = str(args, 0);
    const target = inputs.secondary?.get(name);
    const doc = target === undefined ? undefined : host.document(target);
    if (doc) return doc;
    once(unavailable, name, host, () => ({
      code: 'SECONDARY_DATA_UNAVAILABLE',
      message: `${file}: data source ${name} is not a package XML file; GetDOM gave an empty document`,
      file,
      details: { dataSource: name },
    }));
    return host.emptyDocument();
  };

  /** One element whose text is base64 of a PNG, GIF, JPEG or BMP → its data URL; else ''. */
  const getImageUrl: FnImpl = (args, host) => {
    const nodes = args[0]?.nodes();
    if (!nodes || nodes.length !== 1 || !nodes[0]!.element) return '';
    const b64 = nodes[0]!.string().replace(/[\t\n\r ]+/g, '');
    if (b64.length < 12 || b64.length % 4 !== 0 || !BASE64.test(b64)) return '';
    const head = Uint8Array.from(atob(b64.slice(0, 12)), (c) => c.charCodeAt(0));
    const type = imageType(head);
    if (type === undefined) return '';
    const url = `data:image/${type};base64,${b64}`;
    host.chargeOutput(url.length);
    return url;
  };

  /** Each node as context, `expr` evaluated; one templateDepth level per call. */
  const evalFn: FnImpl = (args, host) =>
    host.nested(() => {
      const nodes = args[0]?.nodes() ?? [];
      const expr = str(args, 1);
      const values: string[] = [];
      for (const node of nodes) {
        const v = host.evaluate(expr, node);
        if (v === undefined) {
          once(failed, expr, host, () => ({
            code: 'EXPRESSION_FAILED',
            message: `${file}: xdMath:Eval expression ${expr} failed; it gave ''`,
            file,
            details: { expr },
          }));
          return '';
        }
        values.push(v);
      }
      return host.makeNodes(values);
    });

  return new Map<string, ReadonlyMap<string, FnImpl>>([
    [NS.xdFormatting, new Map<string, FnImpl>([['formatString', format]])],
    [
      NS.xdXDocument,
      new Map<string, FnImpl>([
        ['GetDOM', getDOM],
        // R4.5: every property it reads is state the InfoPath runtime sets; the caller's default.
        ['GetNamedNodeProperty', (args) => str(args, 2)],
      ]),
    ],
    [NS.xdImage, new Map<string, FnImpl>([['getImageUrl', getImageUrl]])],
    [
      NS.xdDate,
      new Map<string, FnImpl>([
        ['Today', () => today(inputs.now)],
        ['Now', () => nowValue(inputs.now)],
      ]),
    ],
    [
      NS.xdMath,
      new Map<string, FnImpl>([
        ['Avg', (args) => average(strings(args[0]))],
        ['Nz', (args, host) => host.makeNodes(nz(strings(args[0])))],
        ['Eval', evalFn],
      ]),
    ],
    [NS.xdUser, new Map<string, FnImpl>([['get-UserName', () => inputs.userName]])],
    [
      NS.msxsl,
      new Map<string, FnImpl>([
        ['node-set', (args, host) => args[0]?.nodeSet() ?? host.makeNodes([])],
        ['string-compare', (args) => stringCompare(str(args, 0), str(args, 1), str(args, 3))],
      ]),
    ],
  ]);
}
