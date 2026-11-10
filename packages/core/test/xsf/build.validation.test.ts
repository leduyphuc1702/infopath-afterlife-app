import { describe, expect, test } from 'vitest';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { sampleManifests } from '../helpers/manifests';
import { manifestBytes } from '../helpers/synthetic-manifest';
import { readmeTable } from '../oracles/readme-table';

// R10.1–R10.5: calculated fields, error conditions with verbatim messages, xsf3:errorBlank,
// schemaErrorMessages.

const manifests = await sampleManifests();
const all = manifests.map((m) => ({ ...m, ...parseManifest(m.bytes) }));

describe('R10.5 oracle', () => {
  test('19 calculated fields in own forms, 1 in the public sample', () => {
    const own = all.filter((m) => m.own).flatMap((m) => m.manifest.calculations);
    const pub = all.filter((m) => !m.own).flatMap((m) => m.manifest.calculations);
    expect(own).toHaveLength(19);
    expect(pub).toHaveLength(1);
    for (const c of [...own, ...pub]) {
      expect(Object.keys(c.attrs).sort()).toEqual(['expression', 'refresh', 'target']);
    }
  });

  test.each(readmeTable().map((r) => [r.slug, r.counts.Checks] as const))(
    '%s: error conditions equal the README Checks column (%i)',
    (slug, checks) => {
      const m = all.find((x) => x.slug === slug);
      expect(m, slug).toBeDefined();
      expect(m!.manifest.validations).toHaveLength(checks);
    },
  );

  test('totals: 19 + 1 calculated fields; 38 error conditions in forms 01–42, 44 in 01–47, 0 public', () => {
    const own = all.filter((m) => m.own);
    const count = (ms: typeof all, pick: (m: (typeof all)[number]) => readonly unknown[]) =>
      ms.reduce((n, m) => n + pick(m).length, 0);
    const early = own.filter((m) => Number(m.slug.slice(0, 2)) <= 42);
    expect(own).toHaveLength(47);
    expect(early).toHaveLength(42);
    expect(count(own, (m) => m.manifest.calculations)).toBe(19);
    expect(
      count(
        all.filter((m) => !m.own),
        (m) => m.manifest.calculations,
      ),
    ).toBe(1);
    expect(count(early, (m) => m.manifest.validations)).toBe(38);
    expect(count(own, (m) => m.manifest.validations)).toBe(44);
    expect(
      count(
        all.filter((m) => !m.own),
        (m) => m.manifest.validations,
      ),
    ).toBe(0);
  });

  test('the public sample has no error conditions', () => {
    expect(all.find((m) => !m.own)!.manifest.validations).toEqual([]);
  });
});

/**
 * The text and shortMessage of the `xsf:errorMessage` of every `xsf:errorCondition`, read from the
 * bytes with a regular expression (independent of the parser). `xsf:submit/errorMessage` is not
 * inside an errorCondition, so it is not matched.
 */
function messagesInSource(bytes: Uint8Array): { text: string; shortMessage?: string }[] {
  const source = new TextDecoder().decode(bytes);
  const conditions =
    /<xsf:errorCondition\b[^>]*>\s*<xsf:errorMessage\b([^>]*)>([\s\S]*?)<\/xsf:errorMessage>/g;
  return [...source.matchAll(conditions)].map(([, attrs, text]) => {
    const short = /\bshortMessage="([^"]*)"/.exec(attrs!)?.[1];
    return short === undefined
      ? { text: unescapeXml(text!) }
      : { text: unescapeXml(text!), shortMessage: unescapeXml(short) };
  });
}

function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_m, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(Number(e[1] === 'x' ? `0${e.slice(1)}` : e.slice(1)));
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e]!;
  });
}

describe('R10.3: messages verbatim', () => {
  test.each(all.filter((m) => m.own).map((m) => [m.slug, m] as const))(
    '%s: message text and shortMessage equal the manifest',
    (_slug, m) => {
      const built = m.manifest.validations.map((v) =>
        v.message!.attrs.shortMessage === undefined
          ? { text: v.message!.text }
          : { text: v.message!.text, shortMessage: v.message!.attrs.shortMessage },
      );
      expect(built).toEqual(messagesInSource(m.bytes));
    },
  );

  test('form 01: condition and message attributes', () => {
    const v = all.find((m) => m.slug === '01-leave-request')!.manifest.validations[0]!;
    expect(Object.keys(v.attrs).sort()).toEqual(['expression', 'expressionContext', 'match']);
    expect(Object.keys(v.message!.attrs).sort()).toEqual(['shortMessage', 'type']);
    expect(v.message!.key).toBe('xsf:errorMessage');
  });
});

describe('synthetic: whitespace, xsf3:errorBlank, schemaErrorMessages', () => {
  const { manifest: m, unknowns } = parseManifest(
    manifestBytes(`<xsf:customValidation>
  <xsf:errorCondition match="/my:a" expressionContext="." expression=". &lt; 0" showErrorOn="/my:a">
    <xsf:errorMessage type="modal" shortMessage="  Too  LOW ">
  Line one
	tab &amp; "quote"  </xsf:errorMessage>
  </xsf:errorCondition>
  <xsf:errorCondition match="/my:b" expression="false()"/>
</xsf:customValidation>
<xsf:schemaErrorMessages>
  <xsf:override match="/my:a"><xsf:errorMessage shortMessage="Number">Enter a number.</xsf:errorMessage></xsf:override>
  <xsf:override match="/my:b"/>
</xsf:schemaErrorMessages>
<xsf:extensions><xsf:extension name="SolutionDefinitionExtensions">
  <xsf3:solutionDefinition><xsf3:customValidation>
    <xsf3:errorBlank match="/my:a" expressionContext="." expression="true()"/>
    <xsf3:errorBlank match="/my:b"/>
  </xsf3:customValidation></xsf3:solutionDefinition>
</xsf:extension></xsf:extensions>`),
  );

  test('no unknown entries', () => {
    expect(unknowns).toEqual([]);
  });

  test('message text and shortMessage keep whitespace and case', () => {
    const [first, second] = m.validations;
    expect(first!.attrs).toEqual({
      match: '/my:a',
      expressionContext: '.',
      expression: '. < 0',
      showErrorOn: '/my:a',
    });
    expect(first!.message!.attrs).toEqual({ type: 'modal', shortMessage: '  Too  LOW ' });
    expect(first!.message!.text).toBe('\n  Line one\n\ttab & "quote"  ');
    expect(second!).not.toHaveProperty('message');
  });

  test('xsf3:errorBlank', () => {
    expect(m.blankChecks.map((b) => b.attrs)).toEqual([
      { match: '/my:a', expressionContext: '.', expression: 'true()' },
      { match: '/my:b' },
    ]);
    expect(m.containers.map((c) => c.key)).toContain('xsf3:customValidation');
  });

  test('schemaErrorMessages with overrides', () => {
    const sem = m.schemaErrorMessages!;
    expect(sem.overrides.map((o) => [o.attrs, o.message?.text, o.message?.attrs])).toEqual([
      [{ match: '/my:a' }, 'Enter a number.', { shortMessage: 'Number' }],
      [{ match: '/my:b' }, undefined, undefined],
    ]);
  });
});
