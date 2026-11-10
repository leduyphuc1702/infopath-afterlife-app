// Deterministic ids (spec 02 design §4, R13.2). Every id is built from the template alone.

import type { Issue } from '../errors';
import type { Located } from '../unknown';
import type { DataSource } from './types';

const XSL = 'http://www.w3.org/1999/XSL/Transform';
const XD = 'http://schemas.microsoft.com/office/infopath/2003';

/** Exactly the four `Located` fields, whatever else the source object carries. */
export function loc(x: Located): Located {
  return { file: x.file, path: x.path, line: x.line, column: x.column };
}

export type ManifestIdKind =
  'rule' | 'action' | 'calc' | 'val' | 'conn' | 'view' | 'handler' | 'sig' | 'allowed';

/** One data-path step: `prefix:local`, `{uri}local` or `local`; `@` for attributes. */
export function dataStep(
  namespace: string | null,
  local: string,
  nodeType: 'element' | 'attribute',
  namespaces: Readonly<Record<string, string>>,
): string {
  let step = local;
  if (namespace !== null) {
    const prefix = Object.keys(namespaces).find((p) => p !== '' && namespaces[p] === namespace);
    step = prefix === undefined ? `{${namespace}}${local}` : `${prefix}:${local}`;
  }
  return nodeType === 'attribute' ? `@${step}` : step;
}

export function nodeId(kind: 'f' | 'g', dataSource: DataSource, dataPath: string): string {
  return `${kind}:${dataSource}:${dataPath}`;
}

/** Length of the first step of a spec 01 path, braces respected (`/{uri}local[1]`). */
function firstStepEnd(path: string): number {
  let i = 1;
  let inBraces = false;
  for (; i < path.length; i++) {
    const c = path[i];
    if (c === '{') inBraces = true;
    else if (c === '}') inBraces = false;
    else if (c === '/' && !inBraces) break;
  }
  return i;
}

/** A spec 01 path without its root step. */
export function withoutRoot(path: string): string {
  return path.startsWith('/') ? path.slice(firstStepEnd(path)) : path;
}

export function manifestId(kind: ManifestIdKind, path: string): string {
  return `${kind}:${withoutRoot(path)}`;
}

/** The root step dropped, the XSL and xd namespaces written `xsl:` and `xd:`. */
export function compactPath(path: string): string {
  return withoutRoot(path).split(`{${XSL}}`).join('xsl:').split(`{${XD}}`).join('xd:');
}

export function viewElementId(kind: 'ctl' | 'ax', file: string, path: string): string {
  return `${kind}:${file}:${compactPath(path)}`;
}

/** Hands out ids; a repeat gets `#2`, `#3`, … and a DUPLICATE_ID issue (design §4). */
export class IdRegistry {
  private readonly seen = new Map<string, number>();
  readonly issues: Issue[] = [];

  claim(id: string, at?: Located): string {
    const n = (this.seen.get(id) ?? 0) + 1;
    this.seen.set(id, n);
    if (n === 1) return id;
    const out = `${id}#${n}`;
    this.issues.push({
      code: 'DUPLICATE_ID',
      message: `id ${id} is used ${n} times; this one is ${out}`,
      ...(at ? { file: at.file, path: at.path, line: at.line, column: at.column } : {}),
      details: { id, assigned: out },
    });
    return out;
  }
}
