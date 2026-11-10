// The typed manifest (design §5.1). Every modelled element becomes a Modelled<K>: its location
// plus every attribute the vocabulary declares for it that is present, as the original string
// (R7.5). The attribute keys are typed from the table, so a builder cannot add a name the table
// does not declare.

import type { Located } from '../unknown';
import type { SpecKey, XSF_VOCABULARY } from './vocabulary';

export type { SpecKey };

export type AttrName<K extends SpecKey> = keyof (typeof XSF_VOCABULARY)[K]['attrs'] & string;

export interface Modelled<K extends SpecKey> extends Located {
  readonly key: K;
  readonly attrs: Readonly<Partial<Record<AttrName<K>, string>>>;
}

/** `Modelled<K>` for each key of a union, so `key` tells them apart. */
export type AnyModelled<K extends SpecKey = SpecKey> = K extends SpecKey ? Modelled<K> : never;

/** A modelled element whose content is kept as inner XML (R13.5). */
export type RawXml<K extends SpecKey> = Modelled<K> & { readonly raw: string };

/** A modelled element whose content is kept as text, verbatim (R10.3). */
export type WithText<K extends SpecKey> = Modelled<K> & { readonly text: string };

/**
 * Elements that only group others. They carry no data of their own beyond their attributes, so
 * the Manifest lists them once, in `containers`, with their path and attributes (design §8.4).
 */
export type ContainerKey =
  | 'xsf:extensions'
  | 'xsf:extension'
  | 'xsf:package'
  | 'xsf:files'
  | 'xsf:fileProperties'
  | 'xsf:documentSchemas'
  | 'xsf:fileNew'
  | 'xsf:documentVersionUpgrade'
  | 'xsf:views'
  | 'xsf:editing'
  | 'xsf:fragmentToInsert'
  | 'xsf:unboundControls'
  | 'xsf2:viewsExtension'
  | 'xsf3:viewsExtension'
  | 'xsf2:includedViews'
  | 'xsf:ruleSets'
  | 'xsf:rule/exitRuleSet'
  | 'xsf:onLoad'
  | 'xsf:domEventHandlers'
  | 'xsf:calculations'
  | 'xsf:customValidation'
  | 'xsf3:customValidation'
  | 'xsf:dataObjects'
  | 'xsf:dataObject/query'
  | 'xsf:query'
  | 'xsf:dataAdapters'
  | 'xsf2:dataConnections'
  | 'xsf:listProperties'
  | 'xsf:fields'
  | 'xsf2:listPropertiesExtension'
  | 'xsf2:fieldsExtension'
  | 'xsf:permissions'
  | 'xsf:membership'
  | 'xsf3:signatureLines';

export interface Manifest {
  readonly documentClass: Modelled<'xsf:xDocumentClass'>; // R7.1
  readonly solution: Solution; // R7.2
  readonly package: readonly PackageEntry[]; // R7.4
  readonly documentSchemas: readonly Modelled<'xsf:documentSchema'>[];
  readonly fileNew?: Modelled<'xsf:initialXmlDocument'>;
  readonly upgrade?: Modelled<'xsf:useTransform'>; // R7.3
  readonly importParameters?: Modelled<'xsf:importParameters'>;
  readonly applicationParameters: readonly ApplicationParameters[];
  readonly views: readonly View[]; // R8
  /** `xsf:views/@default`, as written. */
  readonly defaultView?: string;
  readonly mergedPrintView?: MergedPrintView; // R8.2
  /** View extensions whose `ref` names no view; kept so nothing is lost. */
  readonly unlinkedViewExtensions: readonly ViewExtension[];
  readonly ruleSets: readonly RuleSet[]; // R9.1–R9.3
  /** Every `xsf:ruleSetAction`, in document order, with what runs it (R9.4). */
  readonly bindings: readonly EventBinding[];
  /** Every `xsf:domEventHandler`, whether it binds a rule set or code (R9.5). */
  readonly domEventHandlers: readonly Modelled<'xsf:domEventHandler'>[];
  readonly calculations: readonly Modelled<'xsf:calculatedField'>[]; // R10.1
  readonly validations: readonly ErrorCondition[]; // R10.2–R10.3
  readonly blankChecks: readonly Modelled<'xsf3:errorBlank'>[]; // R10.4
  readonly schemaErrorMessages?: SchemaErrorMessages; // R10.4
  readonly dataObjects: readonly DataObject[]; // R11.1
  /** The adapter under the root `xsf:query` (the main data source). Its `queryAction` is unknown. */
  readonly mainQuery?: Adapter; // R11.3
  readonly submit?: Submit; // R11.2
  /** `xsf:dataAdapters`: connections outside `xsf:submit`, in document order (R11.2). */
  readonly dataAdapters: readonly Adapter[];
  /** `xsf2:dataConnections` children, linked to their adapter by `ref` (R11.4). */
  readonly connectionExtensions: readonly ConnectionExtension[];
  /** `xsf:listProperties/xsf:fields/xsf:field`: promoted fields (R12.1). */
  readonly promotedFields: readonly Modelled<'xsf:field'>[];
  /** `xsf2:listPropertiesExtension/xsf2:fieldsExtension/xsf2:fieldExtension` (R12.1). */
  readonly promotedFieldExtensions: readonly Modelled<'xsf2:fieldExtension'>[];
  readonly signatures?: Signatures; // R12.2
  readonly roles?: Roles; // R12.3
  readonly scripts?: Scripts; // R12.4
  /** `xsf:permissions/xsf:allowedControl`: ActiveX controls the manifest allows (R12.5). */
  readonly allowedControls: readonly Modelled<'xsf:allowedControl'>[];
  /** Grouping elements (see ContainerKey), in document order. */
  readonly containers: readonly AnyModelled<ContainerKey>[];
}

export interface Solution {
  readonly definition?: Modelled<'xsf2:solutionDefinition'>;
  /** `runtimeCompatibility` split on whitespace; `[]` when absent. */
  readonly runtimeCompatibility: readonly string[];
  readonly server?: Modelled<'xsf2:server'>;
  readonly offline?: Modelled<'xsf2:offline'>;
  readonly xsf3?: Modelled<'xsf3:solutionDefinition'>;
  readonly baseUrl?: Modelled<'xsf3:baseUrl'>;
  /** `xsf2:managedCode` (R12.4). */
  readonly managedCode?: Modelled<'xsf2:managedCode'>;
}

export interface PackageEntry extends Modelled<'xsf:file'> {
  /** `xsf:fileProperties/xsf:property`, in document order (`rootElement`, `namespace`, …). */
  readonly properties: readonly Modelled<'xsf:property'>[];
}

export interface ApplicationParameters extends Modelled<'xsf:applicationParameters'> {
  readonly solutionProperties?: Modelled<'xsf:solutionProperties'>;
}

export interface View extends Modelled<'xsf:view'> {
  /** The view's `name` equals `xsf:views/@default`. */
  readonly isDefault: boolean;
  /**
   * MS-IPFF2 lets the content of a view repeat (an unbounded group), so every child kind is a
   * list. InfoPath writes one `mainpane` per view.
   */
  readonly mainpanes: readonly Modelled<'xsf:mainpane'>[];
  readonly printSettings: readonly PrintSettings[];
  /** Every `xsf:xmlToEdit` of the view's `xsf:editing` elements, in document order. */
  readonly xmlToEdit: readonly XmlToEdit[];
  readonly menuAreas: readonly ButtonArea<'xsf:menuArea'>[];
  readonly toolbars: readonly ButtonArea<'xsf:toolbar'>[];
  readonly unboundButtons: readonly UnboundButton[];
  /** `xsf2:viewExtension` and `xsf3:viewExtension` whose `ref` is this view's name. */
  readonly extensions: readonly ViewExtension[];
}

export interface PrintSettings extends Modelled<'xsf:printSettings'> {
  readonly header?: RawXml<'xsf:header'>;
  readonly footer?: RawXml<'xsf:footer'>;
}

export interface XmlToEdit extends Modelled<'xsf:xmlToEdit'> {
  readonly editWith?: EditWith;
}

export interface EditWith extends Modelled<'xsf:editWith'> {
  /** `fragmentToInsert/chooseFragment`, each with its payload as raw XML. */
  readonly fragments: readonly RawXml<'xsf:chooseFragment'>[];
}

export type ButtonArea<K extends 'xsf:menuArea' | 'xsf:toolbar'> = Modelled<K> & {
  readonly buttons: readonly Modelled<'xsf:button'>[];
};

export type UnboundButton = Modelled<'xsf:unboundControls/button'>;

export type ViewExtension = Modelled<'xsf2:viewExtension'> | Xsf3ViewExtension;

export interface Xsf3ViewExtension extends Modelled<'xsf3:viewExtension'> {
  /** `xsf3:signatureLines/xsf3:signatureLine`, in document order (R12.2). */
  readonly signatureLines: readonly SignatureLine[];
}

export interface MergedPrintView extends Modelled<'xsf2:mergedPrintView'> {
  readonly printSettings?: PrintSettings;
  /** `includedViews/includedView`, in document order. */
  readonly includedViews: readonly Modelled<'xsf2:includedView'>[];
}

// ---- R9: rules and bindings -------------------------------------------------------------------

export type ActionKey =
  | 'xsf:assignmentAction'
  | 'xsf:dialogBoxMessageAction'
  | 'xsf:dialogBoxExpressionAction'
  | 'xsf:switchViewAction'
  | 'xsf:queryAction'
  | 'xsf:rule/submitAction'
  | 'xsf:openNewDocumentAction'
  | 'xsf:closeDocumentAction'
  | 'xsf:changeAdapterProperty'
  | 'xsf:webPartConnectionAction'
  | 'xsf:signSignatureLineAction';

/** `text`: the message or expression of the two dialog actions, verbatim (R9.2). */
export type Action = AnyModelled<ActionKey> & { readonly text?: string };

export interface RuleSet extends Modelled<'xsf:ruleSet'> {
  readonly rules: readonly Rule[];
}

export interface Rule extends Modelled<'xsf:rule'> {
  /** In document order. */
  readonly actions: readonly Action[];
  /** `xsf:exitRuleSet` is present: stop processing the remaining rules (R9.3). */
  readonly exitRuleSet: boolean;
}

/** One `xsf:ruleSetAction` (its `ruleSet` attribute names the rule set) and what runs it. */
export interface EventBinding extends Modelled<'xsf:ruleSetAction'> {
  readonly trigger:
    | { readonly kind: 'fieldChange'; readonly handler: Modelled<'xsf:domEventHandler'> }
    | { readonly kind: 'onLoad' }
    | { readonly kind: 'submit' }
    | { readonly kind: 'button'; readonly view?: string; readonly button: UnboundButton };
}

// ---- R10: validation --------------------------------------------------------------------------

/** The global `xsf:errorMessage`, with its text verbatim (R10.3). */
export type ErrorMessage = WithText<'xsf:errorMessage'>;

export interface ErrorCondition extends Modelled<'xsf:errorCondition'> {
  readonly message?: ErrorMessage;
}

export interface SchemaErrorMessages extends Modelled<'xsf:schemaErrorMessages'> {
  readonly overrides: readonly (Modelled<'xsf:override'> & { readonly message?: ErrorMessage })[];
}

// ---- R11: data connections and submit ---------------------------------------------------------

export type AdapterKey =
  | 'xsf:xmlFileAdapter'
  | 'xsf:adoAdapter'
  | 'xsf:webServiceAdapter'
  | 'xsf:sharepointListAdapter'
  | 'xsf:sharepointListAdapterRW'
  | 'xsf:davAdapter'
  | 'xsf:emailAdapter'
  | 'xsf:submitToHostAdapter'
  | 'xsf:bdcAdapter'
  | 'xsf:hwsAdapter'
  | 'xsf:useHttpHandler'
  | 'xsf:useScriptHandler'
  | 'xsf:useQueryAdapter';

export type AdapterChildKey =
  | 'xsf:operation'
  | 'xsf:hwsOperation'
  | 'xsf:input'
  | 'xsf:emailAdapter/to'
  | 'xsf:emailAdapter/cc'
  | 'xsf:emailAdapter/bcc'
  | 'xsf:emailAdapter/subject'
  | 'xsf:emailAdapter/intro'
  | 'xsf:emailAdapter/attachmentFileName'
  | 'xsf:davAdapter/folderURL'
  | 'xsf:davAdapter/fileName'
  | 'xsf:sharepointListAdapter/field'
  | 'xsf:sharepointListAdapterRW/field';

export type Adapter = AnyModelled<AdapterKey> & {
  /** Where it sits: a data object's or the main `xsf:query`, `xsf:submit`, or `xsf:dataAdapters`. */
  readonly role: 'query' | 'submit' | 'dataAdapter';
  /** Every modelled descendant (operation and input, to/cc/…, folderURL/fileName, field), in document order. */
  readonly children: readonly AnyModelled<AdapterChildKey>[];
  /** `adoAdapter/@connectionString` holds `Password=` or `Pwd=` (R11.5); false for other kinds. */
  readonly containsCredential: boolean;
};

export interface DataObject extends Modelled<'xsf:dataObject'> {
  readonly query?: Adapter;
}

export interface Submit extends Modelled<'xsf:submit'> {
  /** Adapters and handlers in `xsf:submit`, in document order. Its rule set is in `bindings`. */
  readonly adapters: readonly Adapter[];
  readonly submitAction?: Modelled<'xsf:submit/submitAction'>;
  readonly successMessage?: WithText<'xsf:submit/successMessage'>;
  readonly errorMessage?: WithText<'xsf:submit/errorMessage'>;
}

export type ConnectionExtensionKey =
  | 'xsf2:adoAdapterExtension'
  | 'xsf2:davAdapterExtension'
  | 'xsf2:emailAdapterExtension'
  | 'xsf2:sharepointListAdapterExtension'
  | 'xsf2:sharepointListAdapterRWExtension'
  | 'xsf2:useHttpHandlerExtension'
  | 'xsf2:webServiceAdapterExtension'
  | 'xsf2:xmlFileAdapterExtension';

export type ConnectionExtension = AnyModelled<ConnectionExtensionKey> & {
  /** A reference to an external `.udcx` connection file. */
  readonly connectoid?: Modelled<'xsf2:connectoid'>;
  /** `webServiceAdapterExtension` only. */
  readonly relativeQuery?: Modelled<'xsf2:relativeQuery'>;
  /**
   * The path of the adapter this extends: the first adapter, in document order, of the matching
   * kind whose `name` equals `ref`. `useHttpHandlerExtension` has no `ref` and links to the one `useHttpHandler`
   * of `xsf:submit`. Absent when nothing matches.
   */
  readonly adapterPath?: string;
};

// ---- R12: promoted fields, signatures, roles, code, permissions --------------------------------

export interface Signatures extends Modelled<'xsf:documentSignatures'> {
  readonly blocks: readonly SignedDataBlock[];
}

export interface SignedDataBlock extends Modelled<'xsf:signedDataBlock'> {
  /** The message shown when signing, verbatim. */
  readonly message?: WithText<'xsf:signedDataBlock/message'>;
}

export interface SignatureLine extends Modelled<'xsf3:signatureLine'> {
  readonly confirmationMessage?: WithText<'xsf3:signatureLine/confirmationMessage'>;
  readonly suggestedSignerName?: WithText<'xsf3:signatureLine/suggestedSignerName'>;
  readonly suggestedSignerTitle?: WithText<'xsf3:signatureLine/suggestedSignerTitle'>;
  readonly suggestedSignerEmailAddress?: WithText<'xsf3:signatureLine/suggestedSignerEmailAddress'>;
}

export type MembershipKey = 'xsf:userName' | 'xsf:group' | 'xsf:getUserNameFromData';

export interface Roles extends Modelled<'xsf:roles'> {
  readonly roles: readonly Modelled<'xsf:role'>[];
  /** `xsf:membership` entries, in document order. */
  readonly membership: readonly AnyModelled<MembershipKey>[];
}

export interface Scripts extends Modelled<'xsf:scripts'> {
  readonly scripts: readonly Modelled<'xsf:script'>[];
}
