import { describe, expect, test } from 'vitest';
import { parseFormIR, serialiseFormIR } from '../../src/ir/json';
import type { FormIR } from '../../src/ir/types';
import { catchError } from '../helpers/catch-error';

// Spec 02 R13.1 (serialiser), R14 (error cases), design §9. The round trip over samples and
// generated FormIRs is P6 (task 10).

const at = { file: 'manifest.xsf', path: '/xsf:xDocumentClass[1]', line: 2, column: 1 };

const minimal = (): FormIR => ({
  irVersion: 1,
  meta: {
    name: 'Leave Request',
    nameSource: 'caption',
    generation: '2013',
    browserCompatible: false,
    source: at,
  },
  fields: [],
  groups: [],
  views: [],
  rules: [],
  calculations: [],
  validations: [],
  dataConnections: [],
  codeBehind: { present: false, languages: [], files: [], handlers: [] },
  signatures: { blocks: [], signatureLines: [] },
  activeX: { controls: [], allowed: [] },
  dependencies: { references: [] },
  unknowns: [],
  issues: [],
});

const full = (): FormIR => ({
  ...minimal(),
  meta: {
    ...minimal().meta,
    urn: 'urn:x',
    productVersion: '15.0.0',
    generationEvidence: at,
    publishEndpoint: {
      attribute: 'publishUrl',
      value: 'C:\\f.xsn',
      liveness: 'internal',
      reason: 'filePath',
      source: at,
    },
  },
  groups: [
    {
      id: 'g:main:/my:a',
      dataSource: 'main',
      path: '/my:a',
      name: 'a',
      namespace: 'urn:my',
      nodeType: 'element',
      repeating: false,
      optional: false,
      label: 'A',
      labelSource: 'name',
      labelEvidence: { step: 'name' },
      dependencies: { readBy: [], writtenBy: [] },
      source: at,
      kind: 'group',
    },
  ],
  fields: [
    {
      id: 'f:main:/my:a/@b',
      dataSource: 'main',
      path: '/my:a/@b',
      name: 'b',
      namespace: null,
      nodeType: 'attribute',
      groupId: 'g:main:/my:a',
      repeating: false,
      optional: true,
      label: 'B',
      labelSource: 'otherView',
      labelEvidence: { step: 'otherView', viewStep: 'title', view: 'V2', at },
      dependencies: { readBy: [{ elementId: 'calc:/x', role: 'calcExpression' }], writtenBy: [] },
      source: at,
      kind: 'field',
      xsdType: { builtin: 'xsd:string', variety: 'atomic' },
      required: false,
      default: '',
    },
  ],
  rules: [
    {
      id: 'rule:/r',
      ruleSet: 's',
      enabled: true,
      stopProcessing: false,
      source: at,
      unresolvedRefs: [],
      actions: [
        {
          id: 'action:/r/a',
          kind: 'assignmentAction',
          attrs: Object.fromEntries([
            ['__proto__', 'x'],
            ['targetField', 'my:b'],
          ]),
          source: at,
        },
      ],
      triggers: [
        { kind: 'fieldChange', match: '/my:a', source: at },
        { kind: 'button', view: 'V', source: at },
      ],
    },
  ],
  issues: [{ code: 'UNRESOLVED_BINDING', message: 'm', details: { line: 3, reason: 'x' } }],
});

describe('serialiseFormIR', () => {
  test('sorted keys, two-space indent, final newline', () => {
    const s = serialiseFormIR(minimal());
    expect(s.endsWith('}\n')).toBe(true);
    const keys = [...s.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]);
    expect(keys).toEqual([...keys].sort());
  });

  test.each([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['-0', -0],
    ['a Map', new Map()],
  ])('refuses %s with INTERNAL and its path', (_name, value) => {
    const ir = { ...minimal(), meta: { ...minimal().meta, name: value } } as unknown as FormIR;
    const e = catchError(() => serialiseFormIR(ir));
    expect(e.code).toBe('INTERNAL');
    expect(e.details).toMatchObject({ path: '$.meta.name' });
  });
});

describe('parseFormIR', () => {
  test('round trip of a hand-built FormIR with every kind of part', () => {
    const s = serialiseFormIR(full());
    const back = parseFormIR(s);
    expect(back).toEqual(full());
    expect(serialiseFormIR(back)).toBe(s);
  });

  test('__proto__ in attrs is data, not a prototype', () => {
    const back = parseFormIR(serialiseFormIR(full()));
    const a = back.rules[0]!.actions[0]!.attrs;
    expect(Object.keys(a)).toEqual(['__proto__', 'targetField']);
    expect(a.__proto__).toBe('x');
  });

  const mutate = (f: (o: Record<string, unknown>) => void) => {
    const o = JSON.parse(serialiseFormIR(full())) as Record<string, unknown>;
    f(o);
    return JSON.stringify(o);
  };
  const fields = (o: Record<string, unknown>) => o.fields as Record<string, unknown>[];

  test.each([
    ['not JSON', '{', '$'],
    ['not an object', '[1]', '$'],
    ['a missing key', mutate((o) => delete fields(o)[0]!.label), '$.fields[0].label'],
    ['an extra key', mutate((o) => (fields(o)[0]!.extra = 1)), '$.fields[0].extra'],
    [
      'an enum outside its list',
      mutate((o) => (fields(o)[0]!.labelSource = 'guess')),
      '$.fields[0].labelSource',
    ],
    [
      'a fractional line',
      mutate((o) => ((o.meta as { source: { line: number } }).source.line = 1.5)),
      '$.meta.source.line',
    ],
    [
      'an unknown trigger kind',
      mutate(
        (o) => ((o.rules as { triggers: { kind: string }[] }[])[0]!.triggers[0]!.kind = 'timer'),
      ),
      '$.rules[0].triggers[0].kind',
    ],
    [
      'an unknown issue code',
      mutate((o) => ((o.issues as { code: string }[])[0]!.code = 'NOPE')),
      '$.issues[0].code',
    ],
    ['an unknown top-level part', mutate((o) => (o.promotedFields = [])), '$.promotedFields'],
  ])('%s is INVALID_IR at its path', (_name, json, path) => {
    const e = catchError(() => parseFormIR(json));
    expect(e.code).toBe('INVALID_IR');
    expect(e.details).toMatchObject({ path });
  });

  test.each([
    ['2', 2],
    ['absent', undefined],
  ])('irVersion %s is UNSUPPORTED_IR_VERSION', (found, v) => {
    const e = catchError(() => parseFormIR(mutate((o) => (o.irVersion = v))));
    expect(e.code).toBe('UNSUPPORTED_IR_VERSION');
    expect(e.details).toEqual({ found });
  });
});
