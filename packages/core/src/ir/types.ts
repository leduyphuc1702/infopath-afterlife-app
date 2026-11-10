// FormIR (spec 02 design §5): the versioned JSON model of one form. Spec 01 types come from their
// owning modules; src/ never imports src/index.ts. Optional properties are absent, never
// `undefined`.

import type { Issue } from '../errors';
import type { Located, UnknownEntry } from '../unknown';
import type { FieldNode } from '../xsd/types';

export type Attrs = Readonly<Record<string, string>>;
/** `main`, or an `xsf:dataObject/@name`. */
export type DataSource = string;

export interface FormIR {
  readonly irVersion: 1;
  readonly meta: Meta;
  /** Main tree, then secondary trees by name; tree order within each. */
  readonly fields: readonly IrField[];
  readonly groups: readonly IrGroup[];
  readonly views: readonly IrView[];
  readonly rules: readonly IrRule[];
  readonly calculations: readonly IrCalculation[];
  readonly validations: readonly IrValidation[];
  readonly dataConnections: readonly IrConnection[];
  readonly codeBehind: CodeBehind;
  readonly signatures: Signatures;
  readonly activeX: ActiveX;
  readonly dependencies: { readonly references: readonly Reference[] };
  /** Spec 01's, deep-equal, same order (R10). */
  readonly unknowns: readonly UnknownEntry[];
  /** Spec 01's, then this spec's (R1.3). */
  readonly issues: readonly Issue[];
}

export type Generation = '2003' | '2007' | '2010' | '2013' | 'unknown';

export interface Meta {
  readonly name: string;
  readonly nameSource: 'caption' | 'urn' | 'none';
  readonly urn?: string;
  readonly solutionVersion?: string;
  readonly productVersion?: string;
  readonly solutionFormatVersion?: string;
  readonly publishUrl?: string;
  readonly generation: Generation;
  /** The `productVersion` attribute. */
  readonly generationEvidence?: Located;
  readonly browserCompatible: boolean;
  readonly publishEndpoint?: Endpoint;
  readonly source: Located;
}

export interface NodeDependencies {
  readonly readBy: readonly DepRef[];
  readonly writtenBy: readonly DepRef[];
}

export interface IrNodeBase {
  readonly id: string;
  readonly dataSource: DataSource;
  readonly path: string;
  readonly name: string;
  readonly namespace: string | null;
  readonly nodeType: FieldNode['nodeType'];
  /** The nearest enclosing group; absent for a root. */
  readonly groupId?: string;
  readonly repeating: boolean;
  readonly optional: boolean;
  readonly choiceGroup?: string;
  readonly label: string;
  readonly labelSource: LabelSource;
  readonly labelEvidence: LabelEvidence;
  readonly dependencies: NodeDependencies;
  readonly source: Located;
  readonly use?: Located;
}

export interface IrField extends IrNodeBase {
  readonly kind: 'field' | 'richText';
  readonly xsdType: FieldNode['xsdType'];
  readonly required: boolean;
  readonly default?: string;
  readonly fixed?: string;
}

export interface IrGroup extends IrNodeBase {
  readonly kind: 'group';
}

export const LABEL_SOURCES = [
  'title',
  'cell',
  'leftCell',
  'checkboxText',
  'columnHeader',
  'schemaDisplayName',
  'otherView',
  'name',
] as const;
export type LabelSource = (typeof LABEL_SOURCES)[number];
export const VIEW_LABEL_STEPS = [
  'title',
  'cell',
  'leftCell',
  'checkboxText',
  'columnHeader',
] as const;
export type ViewLabelStep = (typeof VIEW_LABEL_STEPS)[number];

export interface LabelEvidence {
  readonly step: LabelSource;
  /** Set for `otherView`: which view step gave the text. */
  readonly viewStep?: ViewLabelStep;
  readonly view?: string;
  /** The text or attribute used; absent for `name`. */
  readonly at?: Located;
}

export interface IrView {
  readonly id: string;
  readonly name: string;
  readonly caption?: string;
  readonly xslFile?: string;
  readonly isDefault: boolean;
  /** Another view's `printView` names this one (R4.1). */
  readonly isPrint: boolean;
  /** `xsf:view/@printView` as written: the name of the view used to print this one. */
  readonly printView?: string;
  /** False when the XSL is missing or unreadable (R4.3). */
  readonly scanned: boolean;
  readonly controls: readonly BoundControl[];
  readonly source: Located;
}

export interface BoundControl {
  readonly id: string;
  readonly xctname?: string;
  readonly ctrlId?: string;
  /** As written. */
  readonly binding: string;
  /** The field or group, when the whole binding is one path. */
  readonly targetId?: string;
  /** ExpressionBox: the binding is an expression. */
  readonly readOnly: boolean;
  /** Static non-empty ScreenTip, own or of its DTPicker. */
  readonly title?: string;
  /** Read attributes that are dynamic attribute value templates. */
  readonly dynamicAttrs?: readonly string[];
  readonly inRepeat: boolean;
  /** Option buttons (R5.1). */
  readonly choice?: { readonly label: string; readonly value?: string };
  readonly choicesFrom?: ChoicesFrom;
  readonly source: Located;
}

export interface ChoicesFrom {
  readonly dataSource: DataSource;
  readonly connectionId?: string;
  /** The `xsl:for-each/@select`, as written. */
  readonly select: string;
  /** Fields named in its predicates. */
  readonly filterIds: readonly string[];
}

export interface IrRule {
  readonly id: string;
  readonly ruleSet: string;
  readonly caption?: string;
  readonly condition?: string;
  readonly enabled: boolean;
  readonly stopProcessing: boolean;
  readonly actions: readonly IrAction[];
  readonly triggers: readonly Trigger[];
  readonly unresolvedRefs: readonly UnresolvedRef[];
  readonly source: Located;
}

export interface IrAction {
  readonly id: string;
  /** Local name: `assignmentAction`, `queryAction`, … */
  readonly kind: string;
  readonly attrs: Attrs;
  readonly text?: string;
  readonly source: Located;
}

export type Trigger = { readonly source: Located } & (
  | { readonly kind: 'fieldChange'; readonly match: string; readonly targetId?: string }
  | { readonly kind: 'onLoad' }
  | { readonly kind: 'submit' }
  | { readonly kind: 'button'; readonly view?: string; readonly button?: string }
);

export interface IrCalculation {
  readonly id: string;
  readonly target: string;
  readonly targetId?: string;
  readonly expression: string;
  readonly refresh?: string;
  readonly unresolvedRefs: readonly UnresolvedRef[];
  readonly source: Located;
}

export interface IrValidation {
  readonly id: string;
  readonly kind: 'errorCondition' | 'blank';
  readonly match: string;
  readonly matchId?: string;
  readonly expressionContext?: string;
  readonly expression?: string;
  readonly message?: {
    readonly type?: string;
    readonly shortMessage?: string;
    readonly text: string;
  };
  readonly unresolvedRefs: readonly UnresolvedRef[];
  readonly source: Located;
}

export interface IrConnection {
  readonly id: string;
  readonly name?: string;
  /** Local name: `adoAdapter`, … */
  readonly adapterKind: string;
  readonly dataSource?: DataSource;
  readonly isQuery: boolean;
  readonly isSubmit: boolean;
  /** `connectionString` redacted (R8.4). */
  readonly attrs: Attrs;
  readonly children: readonly {
    readonly kind: string;
    readonly attrs: Attrs;
    readonly source: Located;
  }[];
  readonly endpoints: readonly Endpoint[];
  readonly credentialRedacted: boolean;
  readonly lineage: { readonly fieldIds: readonly string[]; readonly usedBy: readonly string[] };
  /** Submit values. */
  readonly unresolvedRefs: readonly UnresolvedRef[];
  readonly source: Located;
}

export const LIVENESS_REASONS = [
  'singleLabel',
  'localhost',
  'reservedSuffix',
  'privateIp',
  'loopbackIp',
  'linkLocalIp',
  'localServer',
  'filePath',
  'packageFile',
  'public',
  'unparsed',
] as const;
export type LivenessReason = (typeof LIVENESS_REASONS)[number];

export interface Endpoint {
  /** `wsdlUrl`, `publishUrl`, `xd:server`, … */
  readonly attribute: string;
  /** As written; redacted for connection strings. */
  readonly value: string;
  readonly host?: string;
  readonly liveness: 'internal' | 'package' | 'unknown';
  readonly reason: LivenessReason;
  readonly source: Located;
}

export interface CodeHandler {
  readonly id: string;
  readonly match: string;
  readonly targetId?: string;
  readonly handler: string;
  readonly source: Located;
}

export interface CodeBehind {
  readonly present: boolean;
  readonly languages: readonly string[];
  readonly files: readonly string[];
  readonly handlers: readonly CodeHandler[];
}

export interface SignedBlock {
  readonly id: string;
  readonly name?: string;
  readonly mode?: string;
  readonly message?: string;
  readonly data?: string;
  readonly dataId?: string;
  readonly source: Located;
}

export interface Signatures {
  readonly blocks: readonly SignedBlock[];
  readonly signatureLines: readonly {
    readonly id: string;
    readonly view?: string;
    readonly attrs: Attrs;
    readonly source: Located;
  }[];
}

export interface ActiveXControl {
  readonly id: string;
  readonly view: string;
  readonly classid?: string;
  readonly binding?: string;
  readonly targetId?: string;
  /** `xd:server` (design §8). */
  readonly server?: Endpoint;
  readonly source: Located;
}

export interface ActiveX {
  readonly controls: readonly ActiveXControl[];
  readonly allowed: readonly {
    readonly id: string;
    readonly clsid?: string;
    readonly cabFile?: string;
    readonly source: Located;
  }[];
}

export const DEP_ROLES = [
  'condition',
  'actionExpression',
  'dialogText',
  'assignmentTarget',
  'calcExpression',
  'calcTarget',
  'validationMatch',
  'validationExpression',
  'binding',
  'choicesFilter',
  'submitValue',
  'codeHandler',
  'trigger',
  'signedData',
  'signatureLocation',
] as const;
export type DepRole = (typeof DEP_ROLES)[number];

export interface DepRef {
  readonly elementId: string;
  readonly role: DepRole;
}

export interface Reference extends DepRef {
  readonly targetId: string;
  readonly text: string;
}

export const UNRESOLVED_REASONS = [
  'variable',
  'descendant',
  'wildcard',
  'axis',
  'dynamicGetDom',
  'aboveRoot',
  'notInTree',
  'unknownPrefix',
  'unknownDataSource',
  'stringExpression',
] as const;

export interface UnresolvedRef {
  readonly role: DepRole;
  readonly text: string;
  readonly reason: (typeof UNRESOLVED_REASONS)[number];
}
