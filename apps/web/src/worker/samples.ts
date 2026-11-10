// Design D6: the bundled samples, a lazy chunk the Worker imports on first use.
import type { InputFile } from './protocol';

type Encoded = readonly [string, string, 't' | 'b'];

const decode = ([name, content, kind]: Encoded, sample?: string): InputFile => {
  const bytes =
    kind === 't'
      ? new TextEncoder().encode(content)
      : Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
  return { name, bytes: bytes.buffer, ...(sample !== undefined && { sample }) };
};

/** Loads the chunk; with an id, returns that sample's template and records as input files. */
export default async function samples(id?: string): Promise<InputFile[]> {
  const files = (await import('virtual:sample-files')).default;
  if (id === undefined) return [];
  const s = files[id];
  if (!s) throw new Error(`no sample ${id}`);
  return [decode(s.template, id), ...s.records.map((r) => decode(r))];
}

/**
 * Design D7 warm-up: the samples chunk, then (spec 12 R4.5) the forms 09–42 chunk, so both are
 * cached before `data-ready` and "Triage all samples" works offline.
 */
export async function warmSamples(): Promise<void> {
  await import('virtual:sample-files');
  await import('virtual:sample-more');
}

/**
 * Spec 12 R4.5: every bundled template, and the records of those that have them. Forms 09–42
 * keep core's names (no `sample` id): their captions are better than a slug's words.
 */
export async function allSamples(): Promise<InputFile[]> {
  const files = (await import('virtual:sample-files')).default;
  const more = (await import('virtual:sample-more')).default;
  const extra = Object.keys(more)
    .sort()
    .map((id) => decode(more[id]!.template));
  return Object.keys(files)
    .sort()
    .flatMap((id) => [decode(files[id]!.template, id), ...files[id]!.records.map((r) => decode(r))])
    .concat(extra);
}
