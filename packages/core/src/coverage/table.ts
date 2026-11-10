// Spec 12 R1, design §3, D1: the coverage classification, as data. Every entry names the
// `docs/feature-coverage.md` row it comes from; `test/coverage/table-doc.test.ts` reads the
// Markdown and checks each citation. Spec 05's converter imports this table, so the Coverage
// Report and Triage never disagree.

export type CoverageClass = 'native' | 'emulated' | 'manual' | 'unsupported';
export const COVERAGE_CLASSES: readonly CoverageClass[] = [
  'native',
  'emulated',
  'manual',
  'unsupported',
];

/**
 * `Changed at review (2026-11-11):` users see "Emulated" (the brief's word, with the tooltip
 * below); `docs/feature-coverage.md` says "App". This is the mapping between the two.
 */
export const CLASS_WORDS: Readonly<Record<CoverageClass, { readonly ui: string; readonly doc: string }>> =
  {
    native: { ui: 'Native', doc: 'Native' },
    emulated: { ui: 'Emulated', doc: 'App' },
    manual: { ui: 'Manual', doc: 'Manual' },
    unsupported: { ui: 'Unsupported', doc: 'Unsupported' },
  };
export const EMULATED_TOOLTIP = 'Afterlife runs it in Classic mode';

export type ElementKind =
  | 'control'
  | 'view'
  | 'action'
  | 'calculation'
  | 'validation'
  | 'connection'
  | 'codeBehind'
  | 'activeX'
  | 'signature';

/** A row of `docs/feature-coverage.md`: its section letter and its first cell, as written. */
export interface RowRef {
  readonly section: 'A' | 'B' | 'C' | 'E' | 'F' | 'G' | 'H';
  readonly row: string;
}

export interface CoverageEntry {
  readonly kind: ElementKind;
  /** `xctname`, action kind, adapter kind, `blank`/`condition`; `*` for the whole kind. */
  readonly subtype: string;
  readonly class: CoverageClass;
  readonly cites: RowRef;
  /** Why the class differs from the cited row's Coverage cell, or why it is a judgement call. */
  readonly verify?: string;
}

const entry = (
  kind: ElementKind,
  subtypes: readonly string[],
  cls: CoverageClass,
  section: RowRef['section'],
  row: string,
  verify?: string,
): CoverageEntry[] =>
  subtypes.map((subtype) => ({
    kind,
    subtype,
    class: cls,
    cites: { section, row },
    ...(verify !== undefined && { verify }),
  }));

const ACTIONS_NO_FIXTURE =
  '`changeAdapterProperty`, `openNewDocumentAction`, `dialogBoxMessageAction`, `webPartConnectionAction`, `signSignatureLineAction`';

export const COVERAGE_TABLE: readonly CoverageEntry[] = [
  // A. Controls. `DTPicker_DTText` is the date picker's bound inner control in FormIR.
  ...entry('control', ['PlainText'], 'native', 'A', 'Text (`PlainText`)'),
  ...entry('control', ['DTPicker', 'DTPicker_DTText'], 'native', 'A', 'Date picker (`DTPicker`)'),
  ...entry('control', ['dropdown'], 'native', 'A', 'Dropdown (`dropdown`)'),
  ...entry('control', ['OptionButton'], 'native', 'A', 'Option buttons (`OptionButton`)'),
  ...entry('control', ['CheckBox'], 'native', 'A', 'Checkbox (`CheckBox`)'),
  // Decision 4 (2026-11-11): sections and nested sections are Native.
  ...entry('control', ['Section'], 'native', 'A', 'Section (`Section`)'),
  ...entry('control', ['RepeatingTable'], 'emulated', 'A', 'Repeating table (`RepeatingTable`)'),
  ...entry('control', ['RichText'], 'native', 'A', 'Rich text (`RichText`)'),
  ...entry('control', ['Button'], 'emulated', 'A', 'Button (`Button`)'),
  ...entry('control', ['ExpressionBox'], 'emulated', 'A', 'Expression box (`ExpressionBox`)'),
  ...entry('control', ['RepeatingSection'], 'emulated', 'A', 'Repeating section (`RepeatingSection`)'),
  ...entry('control', ['FileAttachment'], 'native', 'A', 'Attachment (`FileAttachment`)'),
  ...entry('control', ['combobox'], 'native', 'A', 'Combobox (`combobox`)'),
  ...entry('control', ['ChoiceSection'], 'emulated', 'A', 'Choice section (`ChoiceSection`)'),
  ...entry('control', ['ChoiceGroup'], 'emulated', 'A', 'Choice group (`ChoiceGroup`)'),
  ...entry('control', ['InlineImage'], 'native', 'A', 'Picture (`InlineImage`)'),
  ...entry('control', ['ListBox', 'listbox'], 'native', 'A', 'List box / multi-select'),
  // F. Decision 1 (2026-11-11): every view beyond the default is App.
  ...entry('view', ['*'], 'emulated', 'F', 'Multiple views per form'),
  // C. Rules and actions.
  ...entry('action', ['ruleSetAction'], 'emulated', 'C', '`ruleSetAction`'),
  ...entry('action', ['assignmentAction'], 'emulated', 'C', '`assignmentAction`'),
  ...entry('action', ['closeDocumentAction'], 'emulated', 'C', '`closeDocumentAction`'),
  ...entry('action', ['submitAction'], 'native', 'C', '`submitAction`'),
  ...entry('action', ['switchViewAction'], 'emulated', 'C', '`switchViewAction`'),
  ...entry('action', ['queryAction'], 'manual', 'C', '`queryAction`'),
  ...entry('action', ['dialogBoxExpressionAction'], 'emulated', 'C', '`dialogBoxExpressionAction`'),
  ...entry(
    'action',
    [
      'changeAdapterProperty',
      'openNewDocumentAction',
      'dialogBoxMessageAction',
      'webPartConnectionAction',
      'signSignatureLineAction',
    ],
    'manual',
    'C',
    ACTIONS_NO_FIXTURE,
    'the row says "per action"; Manual until each one is decided (no fixture)',
  ),
  // B. Calculations.
  ...entry('calculation', ['*'], 'emulated', 'B', 'Read-only and calculated fields'),
  // E. Decision 3 (2026-11-11): a blank check is Native (`rq`), authored message or not.
  ...entry('validation', ['blank'], 'native', 'E', '`xsf:errorCondition`'),
  ...entry('validation', ['condition'], 'emulated', 'E', 'Custom XPath validation with author message'),
  // G. Data connections.
  ...entry('connection', ['adoAdapter'], 'manual', 'G', '`adoAdapter` (SQL Server)'),
  ...entry('connection', ['webServiceAdapter'], 'manual', 'G', '`webServiceAdapter` (SOAP)'),
  ...entry('connection', ['xmlFileAdapter'], 'emulated', 'G', '`xmlFileAdapter`'),
  ...entry('connection', ['emailAdapter'], 'manual', 'G', '`emailAdapter`'),
  ...entry(
    'connection',
    ['davAdapter', 'sharepointList:submit'],
    'native',
    'G',
    'SharePoint list/library submit',
  ),
  ...entry(
    'connection',
    ['submitToHostAdapter'],
    'native',
    'G',
    '`submitToHostAdapter` (submit handed to the hosting application)',
  ),
  ...entry(
    'connection',
    ['sharepointList:query'],
    'manual',
    'G',
    'Secondary data sources driving dropdowns',
    'no row names a SharePoint list query; its source dies with SharePoint, so Manual, not the row\'s App',
  ),
  // H. Runtime, code, security. Decision 2 (2026-11-11): code-behind is Manual.
  ...entry('codeBehind', ['*'], 'manual', 'H', 'Managed code / VBA / script'),
  ...entry('activeX', ['*'], 'unsupported', 'H', 'ActiveX controls'),
  ...entry('signature', ['*'], 'manual', 'H', 'Digital signatures'),
];
