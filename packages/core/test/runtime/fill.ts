import { readdirSync, readFileSync } from 'node:fs';
import {
  buildFormIR,
  FillSession,
  parseXsn,
  type FormIR,
  type ParsedTemplate,
} from '../../src/index';

const OWN = new URL('../../../../samples/own/', import.meta.url);
const cache = new Map<string, Promise<{ t: ParsedTemplate; ir: FormIR }>>();
export const NOW = '2026-11-11T09:00:00+07:00';

export function templateOf(slug: string) {
  let hit = cache.get(slug);
  if (!hit) {
    hit = parseXsn(readFileSync(new URL(`xsn/${slug}.xsn`, OWN))).then((t) => ({
      t,
      ir: buildFormIR(t),
    }));
    cache.set(slug, hit);
  }
  return hit;
}

/** Record file names of a form, without the empty one. */
export const recordNames = (slug: string): string[] =>
  readdirSync(new URL(`records/${slug}/`, OWN))
    .filter((f) => f.endsWith('.xml') && !f.endsWith('-000-empty.xml'))
    .sort();

export const recordBytes = (slug: string, name: string) =>
  new Uint8Array(readFileSync(new URL(`records/${slug}/${name}`, OWN)));

export const slugs = (): string[] =>
  readdirSync(new URL('xsn/', OWN))
    .map((f) => f.replace(/\.xsn$/, ''))
    .sort();

export async function fill(slug: string, record?: string, initial?: false) {
  const { t, ir } = await templateOf(slug);
  return {
    t,
    ir,
    s: FillSession.open(t, ir, {
      now: NOW,
      ...(record === undefined ? {} : { record: recordBytes(slug, record) }),
      ...(initial === false ? { initial } : {}),
    }),
  };
}
