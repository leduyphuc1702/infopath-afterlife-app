// Counterexamples found by the properties, shrunk by fast-check, replayed on every run (design
// §13.3, R19.3). Add an entry with the bug it found; never delete one.

import type { P1Input } from './p1-inputs';
import type { P12Input } from './p12-inputs';
import type { P13Input } from './p13-inputs';
import type { P4Input } from './p4-inputs';
import type { P5Input } from '../browser/p5-inputs';
import type { FormIR } from '../../src/index';

export interface P1Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P1Input;
}

export const P1_REGRESSIONS: readonly P1Regression[] = [];

export interface P12Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P12Input;
}

export const P12_REGRESSIONS: readonly P12Regression[] = [];

export interface P6Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: FormIR;
}

export const P6_REGRESSIONS: readonly P6Regression[] = [];

export interface P13Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P13Input;
}

export const P13_REGRESSIONS: readonly P13Regression[] = [];

export interface P4Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P4Input;
}

export const P4_REGRESSIONS: readonly P4Regression[] = [];

export interface P5Regression {
  /** What went wrong before the fix, and where it was fixed. */
  readonly note: string;
  readonly case: P5Input;
}

export const P5_REGRESSIONS: readonly P5Regression[] = [
  {
    note:
      'task 12, seed 2097856039: `a{color:red @IMPORT "x";` kept `@IMPORT` inside a value (inert ' +
      'in Chromium, but an R5.1 item); css.ts now drops a value holding @import',
    case: {
      items: [
        { kind: 'styleElement', xsl: '<style>a{color:red @IMPORT &quot;x&quot;;</style>' },
        { kind: 'copyOf', xsl: '<div><xsl:copy-of select="/my:r/my:rich/node()"/></div>' },
      ],
      wrappers: [0, 0, 0, 0, 0, 0],
      page: false,
      head: [],
      bodyAttrs: [],
      record: {
        plain: '"><script>alert(1)</script>',
        url: 'javascript:alert(1)',
        name: 'script',
        attr: 'onclick',
        rich: ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      },
    },
  },
  {
    note:
      'task 12, seed -855157857: `<select><div><select></select></div></select><p>` parsed with ' +
      'the inner select closing the outer one and the orphaned </div> closing the render root, ' +
      'so the <p> stood outside it; html/nesting.ts now keeps select content to option/optgroup',
    case: {
      items: [
        {
          kind: 'comment',
          xsl: '<xsl:comment>&gt;&lt;script&gt;alert(1)&lt;/script&gt;</xsl:comment>',
        },
        { kind: 'copyOf', xsl: '<div><xsl:copy-of select="/my:r/my:rich/node()"/></div>' },
        {
          kind: 'element',
          xsl:
            '<xsl:element name="{/my:r/my:name}"><p title="t"><xsl:attribute name="class">' +
            '<xsl:text disable-output-escaping="yes">&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;</xsl:text>' +
            '</xsl:attribute>d</p></xsl:element>',
        },
      ],
      wrappers: [0, 5, 2, 0, 0, 0],
      page: false,
      head: [],
      bodyAttrs: [],
      record: {
        plain: '"><script>alert(1)</script>',
        url: 'javascript:alert(1)',
        name: 'script',
        attr: 'onclick',
        rich: ['<select><style>&lt;/select&gt;&lt;img src=x onerror=alert(1)&gt;</style></select>'],
      },
    },
  },
];
