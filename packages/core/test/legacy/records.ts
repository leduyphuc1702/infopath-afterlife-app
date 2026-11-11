import { readdirSync, readFileSync } from 'node:fs';
import { buildFormIR, parseXsn, type FormIR, type RecordFile } from '../../src/index';

// Our own templates and their filled records (the `-000-empty.xml` files left out).
const OWN = new URL('../../../../samples/own/', import.meta.url);

export const irOf = async (slug: string): Promise<FormIR> =>
  buildFormIR(await parseXsn(readFileSync(new URL(`xsn/${slug}.xsn`, OWN))));

export function recordsOf(slug: string): RecordFile[] {
  const dir = new URL(`records/${slug}/`, OWN);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.xml') && !f.endsWith('-000-empty.xml'))
    .sort()
    .map((fileName) => ({ fileName, bytes: readFileSync(new URL(fileName, dir)) }));
}

export const slugsWithRecords = () =>
  readdirSync(new URL('records/', OWN))
    .filter((s) => recordsOf(s).length > 0)
    .sort();
