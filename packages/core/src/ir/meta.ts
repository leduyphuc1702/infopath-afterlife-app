// Stage 1: form identity and generation (spec 02 R2, design §5 notes).

import type { Manifest } from '../xsf/types';
import { loc } from './ids';
import type { Generation, Meta } from './types';

const GENERATIONS: Readonly<Record<string, Generation>> = {
  '11': '2003',
  '12': '2007',
  '14': '2010',
  '15': '2013',
};

/** From the major number of `productVersion` only (R2.2). */
export function generationOf(productVersion: string | undefined): Generation {
  const major = /^\s*(\d+)(?:\.|\s*$)/.exec(productVersion ?? '')?.[1];
  return (major !== undefined && GENERATIONS[String(Number(major))]) || 'unknown';
}

export function buildMeta(m: Manifest): Meta {
  const a = m.documentClass.attrs;
  const caption = m.fileNew?.attrs.caption;
  const fromUrn = /infopath:([^:]+):-/.exec(a.name ?? '')?.[1];
  const [name, nameSource] =
    caption !== undefined && caption.trim() !== ''
      ? [caption, 'caption' as const]
      : fromUrn !== undefined
        ? [fromUrn, 'urn' as const]
        : ['', 'none' as const];
  const optional = {
    ...(a.name === undefined ? {} : { urn: a.name }),
    ...(a.solutionVersion === undefined ? {} : { solutionVersion: a.solutionVersion }),
    ...(a.productVersion === undefined ? {} : { productVersion: a.productVersion }),
    ...(a.solutionFormatVersion === undefined
      ? {}
      : { solutionFormatVersion: a.solutionFormatVersion }),
    ...(a.publishUrl === undefined ? {} : { publishUrl: a.publishUrl }),
    ...(a.productVersion === undefined
      ? {}
      : {
          generationEvidence: {
            ...loc(m.documentClass),
            path: `${m.documentClass.path}/@productVersion`,
          },
        }),
  };
  return {
    name,
    nameSource,
    ...optional,
    generation: generationOf(a.productVersion),
    browserCompatible: m.solution.runtimeCompatibility.includes('server'),
    source: loc(m.documentClass),
  };
}
