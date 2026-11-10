// The kitchen-sink manifest (design §8.5): generated from the vocabulary table, it places every spec
// key at a legal position with every attribute set (the first enum value, `yes`, or `x`).
//
// Each child is placed once per parent, so no held-once element repeats. Where MS-IPFF2 makes a
// set of children an xsd:choice that occurs once (`choices` in ms-ipff2.ts, the one input besides
// the table), one member is placed: the first member that no other parent places freely, so that
// every key still appears somewhere.

import { MS_IPFF2 } from '../../src/xsf/ms-ipff2';
import {
  childKey,
  XSF_VOCABULARY,
  type AttrSpec,
  type ElementSpec,
} from '../../src/xsf/vocabulary';
import { NS } from '../../src/xml/path';

const table = XSF_VOCABULARY as Readonly<Record<string, ElementSpec>>;

export interface GeneratedElement {
  readonly key: string;
  readonly path: string;
  /** Attribute names as the table writes them (`name` or `{uri}local`). */
  readonly attrs: readonly string[];
}

export interface KitchenSink {
  readonly xml: string;
  readonly elements: readonly GeneratedElement[];
}

const ROOT = 'xsf:xDocumentClass';
const PAYLOAD = '<k:payload xmlns:k="urn:kitchen-sink">x</k:payload>';

/** Children of `key` that sit in one of its MS-IPFF2 choices. */
function choiceGroups(key: string): readonly (readonly string[])[] {
  const spec = table[key]!;
  const children = Object.values(spec.children).map(childKey);
  return (MS_IPFF2[key]?.choices ?? [])
    .map((g) => g.filter((c) => children.includes(c)))
    .filter((g) => g.length > 0);
}

/** Keys that some parent places outside any choice. */
function placedFreely(): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(table)) {
    const inChoice = new Set(choiceGroups(key).flat());
    for (const c of Object.values(table[key]!.children).map(childKey)) {
      if (!inChoice.has(c)) out.add(c);
    }
  }
  return out;
}

/** For each parent with choices: the one member placed from each group. */
function chosenMembers(): Map<string, Set<string>> {
  const free = placedFreely();
  const chosen = new Map<string, Set<string>>();
  const used = new Set<string>();
  const groups = Object.keys(table)
    .flatMap((key) => choiceGroups(key).map((g) => ({ key, g })))
    // Smaller groups first: fewer options, so pick there before the wider groups do.
    .sort((a, b) => a.g.length - b.g.length);
  for (const { key, g } of groups) {
    const pick = g.find((c) => !free.has(c) && !used.has(c)) ?? g[0]!;
    used.add(pick);
    const set = chosen.get(key) ?? new Set<string>();
    set.add(pick);
    chosen.set(key, set);
  }
  return chosen;
}

function attrValue(spec: AttrSpec): string {
  if (spec === 'string') return 'x';
  if (spec === 'yesNo') return 'yes';
  return 'enum' in spec ? spec.enum[0]! : 'x';
}

const PREFIX_OF_URI = new Map<string, string>([
  [NS.xsf, 'xsf'],
  [NS.xsf2, 'xsf2'],
  [NS.xsf3, 'xsf3'],
]);

export function kitchenSink(): KitchenSink {
  const chosen = chosenMembers();
  const attrPrefixes = new Map<string, string>();
  const elements: GeneratedElement[] = [];

  const render = (key: string, qname: string, path: string, depth: number, stack: string[]) => {
    const spec = table[key]!;
    const attrs = Object.entries(spec.attrs).map(([name, a]) => {
      let written = name;
      if (name.startsWith('{')) {
        const uri = name.slice(1, name.indexOf('}'));
        if (!attrPrefixes.has(uri)) attrPrefixes.set(uri, `a${attrPrefixes.size}`);
        written = `${attrPrefixes.get(uri)!}:${name.slice(name.indexOf('}') + 1)}`;
      }
      return `${written}="${attrValue(a)}"`;
    });
    elements.push({ key, path, attrs: Object.keys(spec.attrs) });
    const pad = '  '.repeat(depth);
    const open = `${pad}<${qname}${attrs.length ? ` ${attrs.join(' ')}` : ''}`;
    if (spec.content === 'text') return `${open}>x</${qname}>`;
    if (spec.content === 'rawXml') return `${open}>${PAYLOAD}</${qname}>`;

    const inChoice = new Set(choiceGroups(key).flat());
    const picks = chosen.get(key) ?? new Set<string>();
    const children: string[] = [];
    for (const [childQname, c] of Object.entries(spec.children)) {
      const target = childKey(c);
      if (inChoice.has(target) && !picks.has(target)) continue;
      if (stack.includes(target)) continue; // no cycles in the table today; never recurse
      children.push(
        render(target, childQname, `${path}/${childQname}[1]`, depth + 1, [...stack, target]),
      );
    }
    if (!children.length) return `${open}/>`;
    return `${open}>\n${children.join('\n')}\n${pad}</${qname}>`;
  };

  const body = render(ROOT, ROOT, `/${ROOT}[1]`, 0, [ROOT]);
  const decls = [
    ...[...PREFIX_OF_URI].map(([uri, p]) => `xmlns:${p}="${uri}"`),
    ...[...attrPrefixes].map(([uri, p]) => `xmlns:${p}="${uri}"`),
  ].join(' ');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${body.replace(/^<xsf:xDocumentClass/, `<xsf:xDocumentClass ${decls}`)}\n`;
  return { xml, elements };
}
