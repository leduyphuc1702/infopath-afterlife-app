import { describe, expect, test } from 'vitest';
import { position, prescan } from '../../src/xml/prescan';
import { catchError } from '../helpers/catch-error';

// R4.5, R5.2, design §7.2 step 3.

const scan =
  (text: string, depth = 256) =>
  () =>
    prescan(text, 'manifest.xsf', depth);
const nested = (n: number) => '<a>'.repeat(n) + '</a>'.repeat(n);

describe('DOCTYPE (R5.2)', () => {
  test('at the start', () => {
    expect(catchError(scan('<!DOCTYPE r [<!ENTITY e "x">]><r/>'))).toMatchObject({
      code: 'UNSAFE_XML',
      details: { file: 'manifest.xsf', line: 1, column: 1 },
    });
  });

  test('after the declaration and a comment, at its line and column', () => {
    const text = '<?xml version="1.0"?>\n<!-- c -->\n  <!DOCTYPE r SYSTEM "http://x/r.dtd">\n<r/>';
    expect(catchError(scan(text))).toMatchObject({
      code: 'UNSAFE_XML',
      details: { line: 3, column: 3 },
    });
  });

  test('lower case is refused as well', () => {
    expect(catchError(scan('<!doctype r><r/>')).code).toBe('UNSAFE_XML');
  });

  test('inside a comment, CDATA, an attribute value or a PI it is not a DOCTYPE', () => {
    for (const text of [
      '<r><!-- <!DOCTYPE r> --></r>',
      '<r><![CDATA[<!DOCTYPE r>]]></r>',
      '<r a="<!DOCTYPE r>" b=\'<!DOCTYPE>\'/>',
      '<?pi <!DOCTYPE r> ?><r/>',
    ]) {
      expect(scan(text), text).not.toThrow();
    }
  });

  test('text that only looks like markup is ignored', () => {
    expect(scan('<r>a &lt;!DOCTYPE b</r>')).not.toThrow();
  });
});

describe('depth (R4.5)', () => {
  test('256 levels pass; 257 fail with the line and column of the 257th start tag', () => {
    expect(scan(nested(256))).not.toThrow();
    const text = '<a>\n'.repeat(257) + '</a>'.repeat(257);
    expect(catchError(scan(text))).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      details: {
        limit: 'xmlDepth',
        max: 256,
        observed: 257,
        file: 'manifest.xsf',
        line: 257,
        column: 1,
      },
    });
  });

  test('self-closing tags, end tags, comments, CDATA and PIs do not add depth', () => {
    const inner = '<b/><c x="/>"></c><!-- <d> --><![CDATA[<e>]]><?f <g> ?><h a=">"/>';
    // Two <a> levels, then <c> at level 3: the self-closing and non-element markup adds nothing.
    expect(scan(`${'<a>'.repeat(2)}${inner.repeat(50)}${'</a>'.repeat(2)}`, 3)).not.toThrow();
    expect(catchError(scan(`${'<a>'.repeat(3)}${inner}${'</a>'.repeat(3)}`, 3)).code).toBe(
      'LIMIT_EXCEEDED',
    );
    expect(scan('<a><b/ ></a>', 1)).not.toThrow();
  });

  test('siblings do not add up', () => {
    expect(scan(`<r>${'<a><b/></a>'.repeat(1_000)}</r>`, 2)).not.toThrow();
  });

  test('100,000 levels fail fast', () => {
    const text = nested(100_000);
    const start = performance.now();
    expect(catchError(scan(text)).details).toMatchObject({ limit: 'xmlDepth', observed: 257 });
    expect(performance.now() - start).toBeLessThan(50);
  });

  test('the limit is the argument', () => {
    expect(catchError(scan(nested(4), 3)).details).toMatchObject({ max: 3, observed: 4 });
  });
});

describe('position', () => {
  test('\\n, \\r\\n and \\r each end a line', () => {
    expect(position('ab', 1)).toEqual({ line: 1, column: 2 });
    expect(position('a\nb\r\nc\rd', 7)).toEqual({ line: 4, column: 1 });
  });
});
