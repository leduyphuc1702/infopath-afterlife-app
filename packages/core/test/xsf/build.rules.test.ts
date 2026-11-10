import { describe, expect, test } from 'vitest';
import type { Manifest } from '../../src/xsf/types';
import { parseManifest } from '../../src/xsf/parse-manifest';
import { formNumber, sampleManifests } from '../helpers/manifests';
import { manifestBytes } from '../helpers/synthetic-manifest';

// R9.1–R9.6: rule sets, rules, actions, exitRuleSet, event bindings, domEventHandler.

const manifests = await sampleManifests();
const all = manifests.map((m) => [m.slug, parseManifest(m.bytes).manifest] as const);
const form = (n: number): Manifest =>
  all.find(([slug]) => !slug.startsWith('theill') && formNumber(slug) === n)![1];

describe('R9.6 oracle across the sample manifests', () => {
  const ruleSets = all.flatMap(([, m]) => m.ruleSets);
  const rules = ruleSets.flatMap((s) => s.rules);
  const actions = rules.flatMap((r) => r.actions);
  const bindings = all.flatMap(([, m]) => m.bindings);

  test('9 rules in 8 rule sets in 5 forms', () => {
    expect(rules).toHaveLength(9);
    expect(ruleSets).toHaveLength(8);
    expect(all.filter(([, m]) => m.ruleSets.length > 0).map(([slug]) => slug)).toEqual([
      '01-leave-request',
      '03-travel-request',
      '04-purchase-request',
      '05-new-hire-onboarding',
      '07-leave-request-v2',
    ]);
  });

  test('7 assignment, 3 switchView, 1 query, 1 dialogBoxExpression', () => {
    const count = (key: string) => actions.filter((a) => a.key === key).length;
    expect(count('xsf:assignmentAction')).toBe(7);
    expect(count('xsf:switchViewAction')).toBe(3);
    expect(count('xsf:queryAction')).toBe(1);
    expect(count('xsf:dialogBoxExpressionAction')).toBe(1);
    expect(actions).toHaveLength(12);
  });

  test('8 ruleSetAction: 2 onLoad, 1 domEventHandler, 5 buttons', () => {
    expect(bindings).toHaveLength(8);
    const kinds = bindings.map((b) => b.trigger.kind);
    expect(kinds.filter((k) => k === 'onLoad')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'fieldChange')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'button')).toHaveLength(5);
  });

  test('every binding names a rule set of its form', () => {
    for (const [slug, m] of all) {
      const names = m.ruleSets.map((s) => s.attrs.name);
      for (const b of m.bindings) expect(names, slug).toContain(b.attrs.ruleSet);
    }
  });
});

describe('forms', () => {
  test('form 05: the three buttons run rule sets whose rule is a switchViewAction (R8.5)', () => {
    const m = form(5);
    const buttons = m.bindings.filter((b) => b.trigger.kind === 'button');
    expect(
      buttons.map((b) => {
        const t = b.trigger as Extract<typeof b.trigger, { kind: 'button' }>;
        const set = m.ruleSets.find((s) => s.attrs.name === b.attrs.ruleSet)!;
        return [t.view, t.button.attrs.name, set.rules[0]!.actions.map((a) => [a.key, a.attrs])];
      }),
    ).toEqual([
      ['HR', 'CTRL910', [['xsf:switchViewAction', { view: 'IT' }]]],
      ['HR', 'CTRL911', [['xsf:switchViewAction', { view: 'Manager' }]]],
      ['IT', 'CTRL912', [['xsf:switchViewAction', { view: 'HR' }]]],
    ]);
    // The trigger's button is the same object as the view's unbound button.
    const t = buttons[0]!.trigger as Extract<(typeof buttons)[0]['trigger'], { kind: 'button' }>;
    expect(t.button).toBe(m.views[0]!.unboundButtons[0]);
  });

  test('form 04: actions in document order across kinds, with all attributes', () => {
    const rule = form(4).ruleSets[0]!.rules[0]!;
    expect(rule.attrs).toEqual({ caption: 'Query budget service', isEnabled: 'yes' });
    expect(rule.actions.map((a) => a.key)).toEqual([
      'xsf:assignmentAction',
      'xsf:queryAction',
      'xsf:assignmentAction',
    ]);
    expect(rule.actions[1]!.attrs).toEqual({ adapter: 'BudgetService' });
    expect(rule.exitRuleSet).toBe(false);
  });

  test('form 04: the dialogBoxExpressionAction text, verbatim', () => {
    const action = form(4)
      .ruleSets.flatMap((s) => s.rules)
      .flatMap((r) => r.actions)
      .find((a) => a.key === 'xsf:dialogBoxExpressionAction')!;
    expect(action.text).toBe(
      'concat("Total ", /my:purchaseRequest/my:grandTotal, " is over 1000: accounting must approve.")',
    );
  });

  test('form 01: onLoad runs setToday', () => {
    expect(form(1).bindings.map((b) => [b.trigger, b.attrs])).toEqual([
      [{ kind: 'onLoad' }, { ruleSet: 'setToday' }],
    ]);
  });

  test('form 03: a field change runs clearCity', () => {
    const m = form(3);
    expect(m.domEventHandlers.map((h) => h.attrs)).toEqual([
      { match: '/my:travelRequest/my:destCountry' },
    ]);
    expect(m.bindings).toHaveLength(1);
    expect(m.bindings[0]!.trigger).toEqual({ kind: 'fieldChange', handler: m.domEventHandlers[0] });
    expect(m.bindings[0]!.path).toBe(
      '/xsf:xDocumentClass[1]/xsf:domEventHandlers[1]/xsf:domEventHandler[1]/xsf:ruleSetAction[1]',
    );
  });

  test('form 47: domEventHandlers with handlerObject and no rule set (R9.5)', () => {
    const m = form(47);
    expect(m.domEventHandlers.map((h) => h.attrs)).toEqual([
      { handlerObject: 'msoxd_my_assetTag', match: '/my:assetCheckoutScript/my:assetTag' },
      { handlerObject: 'msoxd_my_returnDue', match: '/my:assetCheckoutScript/my:returnDue' },
    ]);
    expect(m.bindings).toEqual([]);
  });
});

describe('synthetic: every action kind, exitRuleSet and a submit-free binding order', () => {
  const { manifest: m, unknowns } = parseManifest(
    manifestBytes(`<xsf:ruleSets>
  <xsf:ruleSet name="all">
    <xsf:rule caption="first" condition="1 = 1" isEnabled="no">
      <xsf:dialogBoxMessageAction>  Two  spaces,
a line break &amp; an entity  </xsf:dialogBoxMessageAction>
      <xsf:changeAdapterProperty adapter="Main" adapterProperty="siteUrl" expression="'x'"/>
      <xsf:webPartConnectionAction/>
      <xsf:signSignatureLineAction matchCriteria="signatureLineId" matchValue="s1" isExpression="no"/>
      <xsf:openNewDocumentAction solutionURI="urn:other"/>
      <xsf:submitAction adapter="Email"/>
      <xsf:closeDocumentAction promptToSaveChanges="yes"/>
      <xsf:exitRuleSet/>
    </xsf:rule>
    <xsf:rule caption="second"><xsf:dialogBoxExpressionAction></xsf:dialogBoxExpressionAction></xsf:rule>
  </xsf:ruleSet>
</xsf:ruleSets>
<xsf:onLoad><xsf:ruleSetAction ruleSet="all"/></xsf:onLoad>
<xsf:domEventHandlers><xsf:domEventHandler match="/my:a" dataObject="Main"><xsf:ruleSetAction ruleSet="all"/></xsf:domEventHandler></xsf:domEventHandlers>`),
  );

  test('no unknown entries', () => {
    expect(unknowns).toEqual([]);
  });

  test('every action with its attributes, in document order', () => {
    const [first, second] = m.ruleSets[0]!.rules;
    expect(first!.attrs).toEqual({ caption: 'first', condition: '1 = 1', isEnabled: 'no' });
    expect(first!.actions.map((a) => [a.key, a.attrs])).toEqual([
      ['xsf:dialogBoxMessageAction', {}],
      [
        'xsf:changeAdapterProperty',
        { adapter: 'Main', adapterProperty: 'siteUrl', expression: "'x'" },
      ],
      ['xsf:webPartConnectionAction', {}],
      [
        'xsf:signSignatureLineAction',
        { matchCriteria: 'signatureLineId', matchValue: 's1', isExpression: 'no' },
      ],
      ['xsf:openNewDocumentAction', { solutionURI: 'urn:other' }],
      ['xsf:rule/submitAction', { adapter: 'Email' }],
      ['xsf:closeDocumentAction', { promptToSaveChanges: 'yes' }],
    ]);
    expect(first!.actions[0]!.text).toBe('  Two  spaces,\na line break & an entity  ');
    expect(first!.actions[1]).not.toHaveProperty('text');
    expect(first!.exitRuleSet).toBe(true);
    expect(second!.exitRuleSet).toBe(false);
    expect(second!.actions[0]!.text).toBe('');
  });

  test('the exitRuleSet element is a container with its path', () => {
    expect(m.containers.filter((c) => c.key === 'xsf:rule/exitRuleSet').map((c) => c.path)).toEqual(
      ['/xsf:xDocumentClass[1]/xsf:ruleSets[1]/xsf:ruleSet[1]/xsf:rule[1]/xsf:exitRuleSet[1]'],
    );
  });

  test('bindings in document order: onLoad comes before the field change here', () => {
    expect(m.bindings.map((b) => b.trigger.kind)).toEqual(['onLoad', 'fieldChange']);
    expect(m.domEventHandlers[0]!.attrs).toEqual({ match: '/my:a', dataObject: 'Main' });
  });
});
