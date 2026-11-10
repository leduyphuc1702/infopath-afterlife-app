// Endpoints, liveness and redaction (spec 02 R8.2–R8.4, design §8). No network: a host is
// `internal` only when the text proves it, `unknown` otherwise. There is no `dead`.

import type { Located } from '../unknown';
import { connectionPairs, redactSecrets } from '../xsf/credentials';
import { loc } from './ids';
import type { Endpoint, LivenessReason } from './types';

export { connectionPairs, redactSecrets };

const HOST_KEYS = ['data source', 'server', 'address', 'addr', 'network address'];
type Located2 = { host?: string } & (
  | { kind: 'file' }
  | { kind: 'package' }
  | { kind: 'localServer' }
  | { kind: 'host' }
  | { kind: 'none' }
);

const isFilePath = (v: string) => /^[a-z]:[\\/]/i.test(v) || /^(\\\\|\/\/)/.test(v);

function fromUrl(v: string): Located2 {
  if (/^file:/i.test(v)) return { kind: 'file' };
  try {
    const host = new URL(v).hostname;
    return host ? { kind: 'host', host } : { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}

function fromConnectionString(v: string): Located2 {
  const pair = connectionPairs(v).find((p) => HOST_KEYS.includes(p.key));
  if (!pair) return { kind: 'none' };
  let h = pair.value.replace(/^["'{]|["'}]$/g, '').trim();
  if (isFilePath(h)) return { kind: 'file' };
  h = h
    .replace(/^tcp:/i, '')
    .replace(/,\s*\d+\s*$/, '')
    .replace(/\\.*$/, '')
    .trim();
  if (h === '(local)' || h === '.') return { kind: 'localServer', host: h };
  return h ? { kind: 'host', host: h } : { kind: 'none' };
}

function locate(attribute: string, v: string, packageFiles: ReadonlySet<string>): Located2 {
  const value = v.trim();
  if (attribute === 'connectionString') return fromConnectionString(value);
  if (isFilePath(value)) return { kind: 'file' };
  if (/^[a-z][a-z0-9+.-]+:/i.test(value)) return fromUrl(value);
  const last = value.split(/[\\/]/).pop()!.toLowerCase();
  return last && packageFiles.has(last) ? { kind: 'package' } : { kind: 'none' };
}

function ipv4(h: string): number[] | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  const parts = m?.slice(1).map(Number);
  return parts && parts.every((n) => n <= 255) ? parts : undefined;
}

/** The first 16-bit group of an IPv6 address, or undefined. */
function ipv6First(h: string): number | undefined {
  if (!h.includes(':') || !/^[0-9a-f:.]+$/.test(h)) return undefined;
  if (h.startsWith('::')) return 0;
  const n = parseInt(h.split(':')[0]!, 16);
  return Number.isNaN(n) ? undefined : n;
}

export function hostReason(host: string): LivenessReason {
  const h = host
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (h === 'localhost') return 'localhost';
  if (/\.(localhost|local|home\.arpa|internal)$/.test(h)) return 'reservedSuffix';
  const v4 = ipv4(h);
  if (v4) {
    const [a, b] = v4 as [number, number];
    if (a === 127) return 'loopbackIp';
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))
      return 'privateIp';
    if (a === 169 && b === 254) return 'linkLocalIp';
    return 'public';
  }
  const v6 = ipv6First(h);
  if (v6 !== undefined) {
    if (h === '::1') return 'loopbackIp';
    if ((v6 & 0xfe00) === 0xfc00) return 'privateIp';
    if ((v6 & 0xffc0) === 0xfe80) return 'linkLocalIp';
    return 'public';
  }
  return h.includes('.') ? 'public' : 'singleLabel';
}

/**
 * One endpoint (design §8). `value` is the attribute value as written, with every secret
 * (`redactSecrets`) redacted before it is stored. `packageFiles`: lower-case names of the template's files.
 */
export function classifyEndpoint(
  attribute: string,
  value: string,
  at: Located,
  packageFiles: ReadonlySet<string>,
): Endpoint {
  const where = locate(attribute, value, packageFiles);
  // Redacted whatever the attribute: a URL can carry a userinfo password or `;Password=` (R8.4).
  const stored = redactSecrets(value).value;
  const base = { attribute, value: stored, source: loc(at) };
  const host =
    where.host === undefined
      ? {}
      : {
          host:
            where.kind === 'localServer' ? where.host : where.host.toLowerCase().replace(/\.$/, ''),
        };
  switch (where.kind) {
    case 'file':
      return { ...base, liveness: 'internal', reason: 'filePath' };
    case 'package':
      return { ...base, liveness: 'package', reason: 'packageFile' };
    case 'localServer':
      return { ...base, ...host, liveness: 'internal', reason: 'localServer' };
    case 'none':
      return { ...base, liveness: 'unknown', reason: 'unparsed' };
    case 'host': {
      const reason = hostReason(where.host!);
      return { ...base, ...host, liveness: reason === 'public' ? 'unknown' : 'internal', reason };
    }
  }
}
