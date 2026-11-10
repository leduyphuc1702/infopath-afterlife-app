// The manifest vocabulary (design §8.1, D5): one table that drives both extraction and the
// unknown-entry check. Keys are element positions, as in ms-ipff2.ts: a global element is
// `xsf:rule`, a local element is `<parent key>/<local name>`.

/**
 * An attribute's value space. `yesNo` and `enum` values outside the list are reported (R13.4).
 * `viaWildcard`: a string attribute that MS-IPFF2 does not name on this position but admits
 * through an `xsd:anyAttribute`; modelling it is our choice (design §8.1, "Extension points").
 */
export type AttrSpec =
  'string' | 'yesNo' | { readonly enum: readonly string[] } | { readonly viaWildcard: true };

/**
 * A child position. `viaWildcard` marks a child that MS-IPFF2 does not name at this position but
 * allows through an `xsd:any` wildcard; modelling it is our choice (design §8.1, "Extension
 * points").
 */
export type ChildSpec = string | { readonly key: string; readonly viaWildcard: true };

export interface ElementSpec {
  /** Key: local name, or `{uri}local` for a qualified attribute. */
  readonly attrs: Readonly<Record<string, AttrSpec>>;
  /** Key: the child's qualified name (`xsf:rule`, `{uri}local`); value: its position. */
  readonly children: Readonly<Record<string, ChildSpec>>;
  /**
   * `elements`: element children only, text is unknown; `text`: the text is kept verbatim and
   * element children are unknown; `rawXml`: the content is kept as inner XML (a payload).
   */
  readonly content: 'elements' | 'text' | 'rawXml';
  /** The requirement that models this position. */
  readonly req: string;
}

export type Vocabulary = Readonly<Record<string, ElementSpec>>;

export function childKey(child: ChildSpec): string {
  return typeof child === 'string' ? child : child.key;
}

const S = 'string';
const Y = 'yesNo';
const VIA_WILDCARD = { viaWildcard: true } as const;
/** `xd:autogeneration`, written by InfoPath on `xsf:editWith`; admitted by its xsd:anyAttribute. */
const XD_AUTOGENERATION = '{http://schemas.microsoft.com/office/infopath/2003}autogeneration';

/**
 * Every position R7–R12 model, with its requirement id (design §8.1). Attributes are all those
 * MS-IPFF2 declares on the position, with the same value spaces (`ms-ipff2.ts`); children are the
 * modelled subset. MS-IPFF2 children left out (`taskpane`, `featureRestrictions`,
 * `externalViews`, `hwsWorkflow`, `masterDetail`, `menu`, …) are unknown with `documented: true`.
 */
export const XSF_VOCABULARY = {
  // R7.1
  'xsf:xDocumentClass': {
    attrs: {
      author: S,
      dataFormSolution: Y,
      description: S,
      name: S,
      productVersion: S,
      publishUrl: S,
      requireFullTrust: Y,
      solutionFormatVersion: S,
      solutionVersion: S,
      trustLevel: { enum: ['restricted', 'domain'] },
      trustSetting: { enum: ['manual', 'automatic'] },
    },
    children: {
      'xsf:applicationParameters': 'xsf:applicationParameters',
      'xsf:calculations': 'xsf:calculations',
      'xsf:customValidation': 'xsf:customValidation',
      'xsf:dataAdapters': 'xsf:dataAdapters',
      'xsf:dataObjects': 'xsf:dataObjects',
      'xsf:documentSchemas': 'xsf:documentSchemas',
      'xsf:documentSignatures': 'xsf:documentSignatures',
      'xsf:documentVersionUpgrade': 'xsf:documentVersionUpgrade',
      'xsf:domEventHandlers': 'xsf:domEventHandlers',
      'xsf:extensions': 'xsf:extensions',
      'xsf:fileNew': 'xsf:fileNew',
      'xsf:importParameters': 'xsf:importParameters',
      'xsf:listProperties': 'xsf:listProperties',
      'xsf:onLoad': 'xsf:onLoad',
      'xsf:package': 'xsf:package',
      'xsf:permissions': 'xsf:permissions',
      'xsf:query': 'xsf:query',
      'xsf:roles': 'xsf:roles',
      'xsf:ruleSets': 'xsf:ruleSets',
      'xsf:schemaErrorMessages': 'xsf:schemaErrorMessages',
      'xsf:scripts': 'xsf:scripts',
      'xsf:submit': 'xsf:submit',
      'xsf:views': 'xsf:views',
    },
    content: 'elements',
    req: 'R7.1',
  },
  // R7.2
  'xsf:extensions': {
    attrs: {},
    children: { 'xsf:extension': 'xsf:extension' },
    content: 'elements',
    req: 'R7.2',
  },
  'xsf:extension': {
    attrs: { name: S },
    children: {
      'xsf2:solutionDefinition': { key: 'xsf2:solutionDefinition', viaWildcard: true },
      'xsf3:solutionDefinition': { key: 'xsf3:solutionDefinition', viaWildcard: true },
    },
    content: 'elements',
    req: 'R7.2',
  },
  'xsf2:solutionDefinition': {
    attrs: {
      allowClientOnlyCode: Y,
      description: S,
      runtimeCompatibility: S,
      runtimeCompatibilityURL: S,
      solutionType: S,
      verifyOnServer: Y,
    },
    children: {
      'xsf2:dataConnections': 'xsf2:dataConnections',
      'xsf2:listPropertiesExtension': 'xsf2:listPropertiesExtension',
      'xsf2:managedCode': 'xsf2:managedCode',
      'xsf2:mergedPrintView': 'xsf2:mergedPrintView',
      'xsf2:offline': 'xsf2:offline',
      'xsf2:server': 'xsf2:server',
      'xsf2:viewsExtension': 'xsf2:viewsExtension',
    },
    content: 'elements',
    req: 'R7.2',
  },
  'xsf2:server': {
    attrs: { formLocale: S, isMobileEnabled: Y, isPreSubmitPostBackEnabled: Y },
    children: {},
    content: 'elements',
    req: 'R7.2',
  },
  'xsf2:offline': {
    attrs: { cacheQueries: Y, expirationTime: S, openIfQueryFails: Y },
    children: {},
    content: 'elements',
    req: 'R7.2',
  },
  'xsf3:solutionDefinition': {
    attrs: {},
    children: {
      'xsf3:baseUrl': 'xsf3:baseUrl',
      'xsf3:customValidation': 'xsf3:customValidation',
      'xsf3:viewsExtension': 'xsf3:viewsExtension',
    },
    content: 'elements',
    req: 'R7.2',
  },
  'xsf3:baseUrl': {
    attrs: { queryServerInfo: Y, relativeUrlBase: S },
    children: {},
    content: 'elements',
    req: 'R7.2',
  },
  // R7.3
  'xsf:documentVersionUpgrade': {
    attrs: {},
    children: { 'xsf:useTransform': 'xsf:useTransform' },
    content: 'elements',
    req: 'R7.3',
  },
  'xsf:useTransform': {
    attrs: { maxVersionToUpgrade: S, minVersionToUpgrade: S, transform: S },
    children: {},
    content: 'elements',
    req: 'R7.3',
  },
  // R7.4
  'xsf:package': {
    attrs: {},
    children: { 'xsf:files': 'xsf:files' },
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:files': {
    attrs: {},
    children: { 'xsf:file': 'xsf:file' },
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:file': {
    attrs: { name: S },
    children: { 'xsf:fileProperties': 'xsf:fileProperties' },
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:fileProperties': {
    attrs: {},
    children: { 'xsf:property': 'xsf:property' },
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:property': {
    attrs: { name: S, type: S, value: S },
    children: {},
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:documentSchemas': {
    attrs: {},
    children: { 'xsf:documentSchema': 'xsf:documentSchema' },
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:documentSchema': {
    attrs: { location: S, rootSchema: Y },
    children: {},
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:fileNew': {
    attrs: {},
    children: { 'xsf:initialXmlDocument': 'xsf:initialXmlDocument' },
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:initialXmlDocument': {
    attrs: { caption: S, href: S },
    children: {},
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:importParameters': {
    attrs: { enabled: Y, useScriptHandler: Y },
    children: {},
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:applicationParameters': {
    attrs: { application: { enum: ['InfoPath Design Mode'] } },
    children: { 'xsf:solutionProperties': 'xsf:solutionProperties' },
    content: 'elements',
    req: 'R7.4',
  },
  'xsf:solutionProperties': {
    attrs: {
      allowCustomization: Y,
      automaticallyCreateNodes: Y,
      fullyEditableNamespace: S,
      lastOpenView: S,
      lastVersionNeedingTransform: S,
      publishSaveUrl: S,
      scriptLanguage: S,
    },
    children: {},
    content: 'elements',
    req: 'R7.4',
  },
  // R8.1
  'xsf:views': {
    attrs: { default: S },
    children: { 'xsf:view': 'xsf:view' },
    content: 'elements',
    req: 'R8.1',
  },
  'xsf:view': {
    attrs: {
      caption: S,
      designMode: { enum: ['normal', 'protected'] },
      name: S,
      printView: S,
      showMenuItem: Y,
    },
    children: {
      'xsf:editing': 'xsf:editing',
      'xsf:mainpane': 'xsf:mainpane',
      'xsf:menuArea': 'xsf:menuArea',
      'xsf:printSettings': 'xsf:printSettings',
      'xsf:toolbar': 'xsf:toolbar',
      'xsf:unboundControls': 'xsf:unboundControls',
    },
    content: 'elements',
    req: 'R8.1',
  },
  'xsf:mainpane': {
    attrs: { transform: S },
    children: {},
    content: 'elements',
    req: 'R8.1',
  },
  // R8.2
  'xsf:printSettings': {
    attrs: {
      bottomMargin: S,
      collate: Y,
      copies: S,
      footer: S,
      header: S,
      leftMargin: S,
      marginUnitsType: { enum: ['in', 'cm'] },
      orientation: { enum: ['portrait', 'landscape'] },
      pageRangeEnd: S,
      pageRangeStart: S,
      paperSize: S,
      paperSource: S,
      printerName: S,
      printerSpecificSettings: S,
      rightMargin: S,
      topMargin: S,
    },
    children: { 'xsf:footer': 'xsf:footer', 'xsf:header': 'xsf:header' },
    content: 'elements',
    req: 'R8.2',
  },
  'xsf:header': {
    attrs: {},
    children: {},
    content: 'rawXml',
    req: 'R8.2',
  },
  'xsf:footer': {
    attrs: {},
    children: {},
    content: 'rawXml',
    req: 'R8.2',
  },
  'xsf2:viewsExtension': {
    attrs: {},
    children: { 'xsf2:viewExtension': 'xsf2:viewExtension' },
    content: 'elements',
    req: 'R8.2',
  },
  'xsf2:viewExtension': {
    attrs: { clientOnly: Y, designMode: S, readOnly: Y, ref: S },
    children: {},
    content: 'elements',
    req: 'R8.2',
  },
  'xsf2:mergedPrintView': {
    attrs: { isCustomizable: Y, isDefault: Y, viewBreak: S },
    children: {
      'xsf2:includedViews': 'xsf2:includedViews',
      'xsf:printSettings': 'xsf:printSettings',
    },
    content: 'elements',
    req: 'R8.2',
  },
  'xsf2:includedViews': {
    attrs: {},
    children: { 'xsf2:includedView': 'xsf2:includedView' },
    content: 'elements',
    req: 'R8.2',
  },
  'xsf2:includedView': {
    attrs: { name: S },
    children: {},
    content: 'elements',
    req: 'R8.2',
  },
  'xsf3:viewsExtension': {
    attrs: {},
    children: { 'xsf3:viewExtension': 'xsf3:viewExtension' },
    content: 'elements',
    req: 'R8.2',
  },
  'xsf3:viewExtension': {
    attrs: { ref: S },
    children: { 'xsf3:signatureLines': 'xsf3:signatureLines' },
    content: 'elements',
    req: 'R8.2',
  },
  // R8.3
  'xsf:editing': {
    attrs: {},
    children: { 'xsf:xmlToEdit': 'xsf:xmlToEdit' },
    content: 'elements',
    req: 'R8.3',
  },
  'xsf:xmlToEdit': {
    attrs: { container: S, item: S, name: S, viewContext: S },
    children: { 'xsf:editWith': 'xsf:editWith' },
    content: 'elements',
    req: 'R8.3',
  },
  'xsf:editWith': {
    attrs: {
      allowedFileTypes: S,
      autoComplete: Y,
      caption: S,
      component: {
        enum: [
          'xCollection',
          'xOptional',
          'xReplace',
          'xTextList',
          'xField',
          'xImage',
          'xFileAttachment',
        ],
      },
      field: S,
      filterDependency: S,
      maxLength: S,
      proofing: Y,
      removeAncestors: S,
      type: { enum: ['plain', 'formatted', 'plainMultiline', 'formattedMultiline', 'rich'] },
      useFilter: { enum: ['yes', 'no'] },
      widgetIcon: { enum: ['standard', 'filter'] },
      [XD_AUTOGENERATION]: VIA_WILDCARD,
    },
    children: { 'xsf:fragmentToInsert': 'xsf:fragmentToInsert' },
    content: 'elements',
    req: 'R8.3',
  },
  'xsf:fragmentToInsert': {
    attrs: {},
    children: { 'xsf:chooseFragment': 'xsf:chooseFragment' },
    content: 'elements',
    req: 'R8.3',
  },
  'xsf:chooseFragment': {
    attrs: { followingSiblings: S, innerFragment: S, parent: S },
    children: {},
    content: 'rawXml',
    req: 'R8.3',
  },
  // R8.4
  'xsf:menuArea': {
    attrs: {
      name: {
        enum: [
          'msoFileMenu',
          'msoEditMenu',
          'msoInsertMenu',
          'msoViewMenu',
          'msoFormatMenu',
          'msoToolsMenu',
          'msoTableMenu',
          'msoHelpMenu',
          'msoStructuralEditingContextMenu',
        ],
      },
    },
    children: { 'xsf:button': 'xsf:button' },
    content: 'elements',
    req: 'R8.4',
  },
  'xsf:toolbar': {
    attrs: { caption: S, name: S },
    children: { 'xsf:button': 'xsf:button' },
    content: 'elements',
    req: 'R8.4',
  },
  'xsf:button': {
    attrs: {
      action: {
        enum: [
          'xCollection::insert',
          'xCollection::insertBefore',
          'xCollection::insertAfter',
          'xCollection::remove',
          'xCollection::refreshFilter',
          'xCollection::removeAll',
          'xOptional::insert',
          'xOptional::remove',
          'xReplace::replace',
          'xFileAttachment::attach',
          'xFileAttachment::open',
          'xFileAttachment::saveAs',
          'xFileAttachment::remove',
        ],
      },
      caption: S,
      icon: S,
      name: S,
      showIf: { enum: ['always', 'enabled', 'immediate'] },
      tooltip: S,
      xmlToEdit: S,
    },
    children: {},
    content: 'elements',
    req: 'R8.4',
  },
  'xsf:unboundControls': {
    attrs: {},
    children: { 'xsf:button': 'xsf:unboundControls/button' },
    content: 'elements',
    req: 'R8.4',
  },
  'xsf:unboundControls/button': {
    attrs: { name: S },
    children: { 'xsf:ruleSetAction': 'xsf:ruleSetAction' },
    content: 'elements',
    req: 'R8.4',
  },
  // R9.1
  'xsf:ruleSets': {
    attrs: {},
    children: { 'xsf:ruleSet': 'xsf:ruleSet' },
    content: 'elements',
    req: 'R9.1',
  },
  'xsf:ruleSet': {
    attrs: { name: S },
    children: { 'xsf:rule': 'xsf:rule' },
    content: 'elements',
    req: 'R9.1',
  },
  'xsf:rule': {
    attrs: { caption: S, condition: S, isEnabled: Y },
    children: {
      'xsf:assignmentAction': 'xsf:assignmentAction',
      'xsf:changeAdapterProperty': 'xsf:changeAdapterProperty',
      'xsf:closeDocumentAction': 'xsf:closeDocumentAction',
      'xsf:dialogBoxExpressionAction': 'xsf:dialogBoxExpressionAction',
      'xsf:dialogBoxMessageAction': 'xsf:dialogBoxMessageAction',
      'xsf:openNewDocumentAction': 'xsf:openNewDocumentAction',
      'xsf:queryAction': 'xsf:queryAction',
      'xsf:exitRuleSet': 'xsf:rule/exitRuleSet',
      'xsf:submitAction': 'xsf:rule/submitAction',
      'xsf:signSignatureLineAction': 'xsf:signSignatureLineAction',
      'xsf:switchViewAction': 'xsf:switchViewAction',
      'xsf:webPartConnectionAction': 'xsf:webPartConnectionAction',
    },
    content: 'elements',
    req: 'R9.1',
  },
  // R9.2
  'xsf:assignmentAction': {
    attrs: { expression: S, targetField: S },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:switchViewAction': {
    attrs: { view: S },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:queryAction': {
    attrs: { adapter: S },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:rule/submitAction': {
    attrs: { adapter: S },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:openNewDocumentAction': {
    attrs: { solutionURI: S },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:closeDocumentAction': {
    attrs: { promptToSaveChanges: Y },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:changeAdapterProperty': {
    attrs: { adapter: S, adapterProperty: S, expression: S },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:webPartConnectionAction': {
    attrs: {},
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:signSignatureLineAction': {
    attrs: {
      checkHost: S,
      checkHostEnabled: Y,
      defaultSignaturePicture: S,
      isExpression: Y,
      isSignaturePictureExpression: Y,
      matchCriteria: { enum: ['suggestedSignerName', 'suggestedSignerEmail', 'signatureLineId'] },
      matchValue: S,
      signaturePictureEnabled: Y,
    },
    children: {},
    content: 'elements',
    req: 'R9.2',
  },
  'xsf:dialogBoxMessageAction': {
    attrs: {},
    children: {},
    content: 'text',
    req: 'R9.2',
  },
  'xsf:dialogBoxExpressionAction': {
    attrs: {},
    children: {},
    content: 'text',
    req: 'R9.2',
  },
  // R9.3
  'xsf:rule/exitRuleSet': {
    attrs: {},
    children: {},
    content: 'elements',
    req: 'R9.3',
  },
  // R9.4
  'xsf:ruleSetAction': {
    attrs: { ruleSet: S },
    children: {},
    content: 'elements',
    req: 'R9.4',
  },
  'xsf:onLoad': {
    attrs: {},
    children: { 'xsf:ruleSetAction': 'xsf:ruleSetAction' },
    content: 'elements',
    req: 'R9.4',
  },
  // R9.5
  'xsf:domEventHandlers': {
    attrs: {},
    children: { 'xsf:domEventHandler': 'xsf:domEventHandler' },
    content: 'elements',
    req: 'R9.5',
  },
  'xsf:domEventHandler': {
    attrs: { dataObject: S, handlerObject: S, match: S },
    children: { 'xsf:ruleSetAction': 'xsf:ruleSetAction' },
    content: 'elements',
    req: 'R9.5',
  },
  // R10.1
  'xsf:calculations': {
    attrs: { treatBlankValueAsZero: Y },
    children: { 'xsf:calculatedField': 'xsf:calculatedField' },
    content: 'elements',
    req: 'R10.1',
  },
  'xsf:calculatedField': {
    attrs: { expression: S, refresh: S, target: S },
    children: {},
    content: 'elements',
    req: 'R10.1',
  },
  // R10.2
  'xsf:customValidation': {
    attrs: {},
    children: { 'xsf:errorCondition': 'xsf:errorCondition' },
    content: 'elements',
    req: 'R10.2',
  },
  'xsf:errorCondition': {
    attrs: { expression: S, expressionContext: S, match: S, showErrorOn: S },
    children: { 'xsf:errorMessage': 'xsf:errorMessage' },
    content: 'elements',
    req: 'R10.2',
  },
  'xsf:errorMessage': {
    attrs: { shortMessage: S, type: { enum: ['modal', 'modeless'] } },
    children: {},
    content: 'text',
    req: 'R10.2',
  },
  // R10.4
  'xsf3:customValidation': {
    attrs: {},
    children: { 'xsf3:errorBlank': 'xsf3:errorBlank' },
    content: 'elements',
    req: 'R10.4',
  },
  'xsf3:errorBlank': {
    attrs: { expression: S, expressionContext: S, match: S },
    children: {},
    content: 'elements',
    req: 'R10.4',
  },
  'xsf:schemaErrorMessages': {
    attrs: {},
    children: { 'xsf:override': 'xsf:override' },
    content: 'elements',
    req: 'R10.4',
  },
  'xsf:override': {
    attrs: { match: S },
    children: { 'xsf:errorMessage': 'xsf:errorMessage' },
    content: 'elements',
    req: 'R10.4',
  },
  // R11.1
  'xsf:dataObjects': {
    attrs: {},
    children: { 'xsf:dataObject': 'xsf:dataObject' },
    content: 'elements',
    req: 'R11.1',
  },
  'xsf:dataObject': {
    attrs: { initOnLoad: Y, name: S, schema: S },
    children: { 'xsf:query': 'xsf:dataObject/query' },
    content: 'elements',
    req: 'R11.1',
  },
  'xsf:dataObject/query': {
    attrs: {},
    children: {
      'xsf:adoAdapter': 'xsf:adoAdapter',
      'xsf:sharepointListAdapter': 'xsf:sharepointListAdapter',
      'xsf:sharepointListAdapterRW': 'xsf:sharepointListAdapterRW',
      'xsf:webServiceAdapter': 'xsf:webServiceAdapter',
      'xsf:xmlFileAdapter': 'xsf:xmlFileAdapter',
    },
    content: 'elements',
    req: 'R11.1',
  },
  // R11.2
  'xsf:submit': {
    attrs: {
      caption: S,
      disableMenuItem: Y,
      onAfterSubmit: { enum: ['close', 'keepOpen', 'openNew'] },
      showSignatureReminder: Y,
      showStatusDialog: Y,
    },
    children: {
      'xsf:davAdapter': 'xsf:davAdapter',
      'xsf:emailAdapter': 'xsf:emailAdapter',
      'xsf:ruleSetAction': 'xsf:ruleSetAction',
      'xsf:errorMessage': 'xsf:submit/errorMessage',
      'xsf:submitAction': 'xsf:submit/submitAction',
      'xsf:successMessage': 'xsf:submit/successMessage',
      'xsf:submitToHostAdapter': 'xsf:submitToHostAdapter',
      'xsf:useHttpHandler': 'xsf:useHttpHandler',
      'xsf:useQueryAdapter': 'xsf:useQueryAdapter',
      'xsf:useScriptHandler': 'xsf:useScriptHandler',
      'xsf:webServiceAdapter': 'xsf:webServiceAdapter',
    },
    content: 'elements',
    req: 'R11.2',
  },
  'xsf:submit/submitAction': {
    attrs: { adapter: S },
    children: {},
    content: 'elements',
    req: 'R11.2',
  },
  'xsf:submit/successMessage': {
    attrs: {},
    children: {},
    content: 'text',
    req: 'R11.2',
  },
  'xsf:submit/errorMessage': {
    attrs: {},
    children: {},
    content: 'text',
    req: 'R11.2',
  },
  'xsf:dataAdapters': {
    attrs: {},
    children: {
      'xsf:adoAdapter': 'xsf:adoAdapter',
      'xsf:davAdapter': 'xsf:davAdapter',
      'xsf:emailAdapter': 'xsf:emailAdapter',
      'xsf:hwsAdapter': 'xsf:hwsAdapter',
      'xsf:sharepointListAdapter': 'xsf:sharepointListAdapter',
      'xsf:submitToHostAdapter': 'xsf:submitToHostAdapter',
      'xsf:webServiceAdapter': 'xsf:webServiceAdapter',
      'xsf:xmlFileAdapter': 'xsf:xmlFileAdapter',
    },
    content: 'elements',
    req: 'R11.2',
  },
  // R11.3
  'xsf:query': {
    attrs: {},
    children: {
      'xsf:adoAdapter': 'xsf:adoAdapter',
      'xsf:bdcAdapter': 'xsf:bdcAdapter',
      'xsf:sharepointListAdapter': 'xsf:sharepointListAdapter',
      'xsf:sharepointListAdapterRW': 'xsf:sharepointListAdapterRW',
      'xsf:webServiceAdapter': 'xsf:webServiceAdapter',
      'xsf:xmlFileAdapter': 'xsf:xmlFileAdapter',
    },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:xmlFileAdapter': {
    attrs: { fileUrl: S, name: S },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:adoAdapter': {
    attrs: { commandText: S, connectionString: S, name: S, queryAllowed: Y, submitAllowed: Y },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:submitToHostAdapter': {
    attrs: { name: S, queryAllowed: Y, submitAllowed: Y },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:bdcAdapter': {
    attrs: {
      entityName: S,
      entityNamespace: S,
      entitySchemaVersion: S,
      lobSystemInstance: S,
      name: S,
      queryAllowed: Y,
      specificFinder: S,
      submitAdapterName: S,
      submitAllowed: Y,
    },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:useHttpHandler': {
    attrs: { href: S, method: { enum: ['POST'] } },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:useScriptHandler': {
    attrs: {},
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:useQueryAdapter': {
    attrs: {},
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:sharepointListAdapter/field': {
    attrs: { infopathName: S, isLookup: Y, sharepointName: S },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:sharepointListAdapterRW/field': {
    attrs: {
      appendOnly: Y,
      auxDomName: S,
      hiddenFieldName: S,
      internalName: S,
      required: Y,
      showFieldName: S,
      type: S,
    },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:davAdapter/folderURL': {
    attrs: { value: S },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:davAdapter/fileName': {
    attrs: { value: S, valueType: { enum: ['expression', 'literal'] } },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:emailAdapter/to': {
    attrs: { value: S, valueType: { enum: ['expression', 'literal'] } },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:emailAdapter/cc': {
    attrs: { value: S, valueType: { enum: ['expression', 'literal'] } },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:emailAdapter/bcc': {
    attrs: { value: S, valueType: { enum: ['expression', 'literal'] } },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:emailAdapter/subject': {
    attrs: { value: S, valueType: { enum: ['expression', 'literal'] } },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:emailAdapter/intro': {
    attrs: { value: S },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:emailAdapter/attachmentFileName': {
    attrs: { value: S, valueType: { enum: ['expression', 'literal'] } },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:webServiceAdapter': {
    attrs: { name: S, queryAllowed: Y, submitAllowed: Y, useDataSet: Y, wsdlUrl: S },
    children: { 'xsf:operation': 'xsf:operation' },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:operation': {
    attrs: { name: S, serviceUrl: S, soapAction: S },
    children: { 'xsf:input': 'xsf:input' },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:input': {
    attrs: { source: S },
    children: {},
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:sharepointListAdapter': {
    attrs: {
      infopathGroup: S,
      name: S,
      queryAllowed: Y,
      sharepointGuid: S,
      siteUrl: S,
      submitAllowed: Y,
    },
    children: { 'xsf:field': 'xsf:sharepointListAdapter/field' },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:sharepointListAdapterRW': {
    attrs: {
      autogen: Y,
      contentTypeID: S,
      name: S,
      queryAllowed: Y,
      queryOneItemOnly: Y,
      relativeListUrl: S,
      sharePointListChoices: S,
      sharePointListID: S,
      siteURL: S,
      sortAscending: Y,
      sortBy: S,
      submitAllowed: Y,
      version: S,
    },
    children: { 'xsf:field': 'xsf:sharepointListAdapterRW/field' },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:davAdapter': {
    attrs: { name: S, overwriteAllowed: Y, queryAllowed: Y, submitAllowed: Y },
    children: {
      'xsf:fileName': 'xsf:davAdapter/fileName',
      'xsf:folderURL': 'xsf:davAdapter/folderURL',
    },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:emailAdapter': {
    attrs: { name: S, queryAllowed: Y, submitAllowed: Y },
    children: {
      'xsf:attachmentFileName': 'xsf:emailAdapter/attachmentFileName',
      'xsf:bcc': 'xsf:emailAdapter/bcc',
      'xsf:cc': 'xsf:emailAdapter/cc',
      'xsf:intro': 'xsf:emailAdapter/intro',
      'xsf:subject': 'xsf:emailAdapter/subject',
      'xsf:to': 'xsf:emailAdapter/to',
    },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:hwsAdapter': {
    attrs: { name: S, queryAllowed: Y, submitAllowed: Y, wsdlUrl: S },
    children: { 'xsf:hwsOperation': 'xsf:hwsOperation' },
    content: 'elements',
    req: 'R11.3',
  },
  'xsf:hwsOperation': {
    attrs: { serviceUrl: S, type: S, typeID: S },
    children: { 'xsf:input': 'xsf:input' },
    content: 'elements',
    req: 'R11.3',
  },
  // R11.4
  'xsf2:dataConnections': {
    attrs: {},
    children: {
      'xsf2:adoAdapterExtension': 'xsf2:adoAdapterExtension',
      'xsf2:davAdapterExtension': 'xsf2:davAdapterExtension',
      'xsf2:emailAdapterExtension': 'xsf2:emailAdapterExtension',
      'xsf2:sharepointListAdapterExtension': 'xsf2:sharepointListAdapterExtension',
      'xsf2:sharepointListAdapterRWExtension': 'xsf2:sharepointListAdapterRWExtension',
      'xsf2:useHttpHandlerExtension': 'xsf2:useHttpHandlerExtension',
      'xsf2:webServiceAdapterExtension': 'xsf2:webServiceAdapterExtension',
      'xsf2:xmlFileAdapterExtension': 'xsf2:xmlFileAdapterExtension',
    },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:adoAdapterExtension': {
    attrs: { queryFile: S, queryKey: S, ref: S, submitAdapterName: S },
    children: { 'xsf2:connectoid': 'xsf2:connectoid' },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:davAdapterExtension': {
    attrs: { ref: S },
    children: { 'xsf2:connectoid': 'xsf2:connectoid' },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:emailAdapterExtension': {
    attrs: { emailAttachmentType: S, ref: S },
    children: {},
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:sharepointListAdapterExtension': {
    attrs: { queryFile: S, queryKey: S, queryThisFormOnly: Y, ref: S, sharepointWebGuid: S },
    children: { 'xsf2:connectoid': 'xsf2:connectoid' },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:sharepointListAdapterRWExtension': {
    attrs: { queryFile: S, queryKey: S, queryThisFormOnly: Y, ref: S },
    children: { 'xsf2:connectoid': 'xsf2:connectoid' },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:useHttpHandlerExtension': {
    attrs: {},
    children: { 'xsf2:connectoid': 'xsf2:connectoid' },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:webServiceAdapterExtension': {
    attrs: { queryFile: S, queryKey: S, ref: S, trackDataSetChanges: Y },
    children: { 'xsf2:connectoid': 'xsf2:connectoid', 'xsf2:relativeQuery': 'xsf2:relativeQuery' },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:xmlFileAdapterExtension': {
    attrs: { isRest: Y, queryFile: S, queryKey: S, ref: S },
    children: { 'xsf2:connectoid': 'xsf2:connectoid' },
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:connectoid': {
    attrs: { connectionLinkType: S, name: S, siteCollection: S, source: S },
    children: {},
    content: 'elements',
    req: 'R11.4',
  },
  'xsf2:relativeQuery': {
    attrs: { replace: S },
    children: {},
    content: 'elements',
    req: 'R11.4',
  },
  // R12.1
  'xsf:listProperties': {
    attrs: {},
    children: { 'xsf:fields': 'xsf:fields' },
    content: 'elements',
    req: 'R12.1',
  },
  'xsf:fields': {
    attrs: {},
    children: { 'xsf:field': 'xsf:field' },
    content: 'elements',
    req: 'R12.1',
  },
  'xsf:field': {
    attrs: {
      aggregation: {
        enum: ['sum', 'count', 'average', 'min', 'max', 'first', 'last', 'merge', 'plaintext'],
      },
      columnName: S,
      maxLength: S,
      name: S,
      node: S,
      required: Y,
      type: S,
      viewable: Y,
    },
    children: {},
    content: 'elements',
    req: 'R12.1',
  },
  'xsf2:listPropertiesExtension': {
    attrs: {},
    children: { 'xsf2:fieldsExtension': 'xsf2:fieldsExtension' },
    content: 'elements',
    req: 'R12.1',
  },
  'xsf2:fieldsExtension': {
    attrs: {},
    children: { 'xsf2:fieldExtension': 'xsf2:fieldExtension' },
    content: 'elements',
    req: 'R12.1',
  },
  'xsf2:fieldExtension': {
    attrs: { columnId: S, columnName: S, readWrite: Y },
    children: {},
    content: 'elements',
    req: 'R12.1',
  },
  // R12.2
  'xsf:documentSignatures': {
    attrs: { signatureLocation: S },
    children: { 'xsf:signedDataBlock': 'xsf:signedDataBlock' },
    content: 'elements',
    req: 'R12.2',
  },
  'xsf:signedDataBlock': {
    attrs: {
      data: S,
      mode: { enum: ['countersign', 'cosign', 'single'] },
      name: S,
      signatureLocation: S,
    },
    children: { 'xsf:message': 'xsf:signedDataBlock/message' },
    content: 'elements',
    req: 'R12.2',
  },
  'xsf:signedDataBlock/message': {
    attrs: {},
    children: {},
    content: 'text',
    req: 'R12.2',
  },
  'xsf3:signatureLines': {
    attrs: {},
    children: { 'xsf3:signatureLine': 'xsf3:signatureLine' },
    content: 'elements',
    req: 'R12.2',
  },
  'xsf3:signatureLine': {
    attrs: { name: S, showDate: Y, signatureType: { enum: ['line', 'stamp'] }, signedDataBlock: S },
    children: {
      'xsf3:confirmationMessage': 'xsf3:signatureLine/confirmationMessage',
      'xsf3:suggestedSignerEmailAddress': 'xsf3:signatureLine/suggestedSignerEmailAddress',
      'xsf3:suggestedSignerName': 'xsf3:signatureLine/suggestedSignerName',
      'xsf3:suggestedSignerTitle': 'xsf3:signatureLine/suggestedSignerTitle',
    },
    content: 'elements',
    req: 'R12.2',
  },
  'xsf3:signatureLine/confirmationMessage': {
    attrs: {},
    children: {},
    content: 'text',
    req: 'R12.2',
  },
  'xsf3:signatureLine/suggestedSignerName': {
    attrs: { isCalculation: Y },
    children: {},
    content: 'text',
    req: 'R12.2',
  },
  'xsf3:signatureLine/suggestedSignerTitle': {
    attrs: { isCalculation: Y },
    children: {},
    content: 'text',
    req: 'R12.2',
  },
  'xsf3:signatureLine/suggestedSignerEmailAddress': {
    attrs: { isCalculation: Y },
    children: {},
    content: 'text',
    req: 'R12.2',
  },
  // R12.3
  'xsf:roles': {
    attrs: { default: S, hideStatusBarDisplay: Y, initiator: S },
    children: { 'xsf:membership': 'xsf:membership', 'xsf:role': 'xsf:role' },
    content: 'elements',
    req: 'R12.3',
  },
  'xsf:role': {
    attrs: { name: S },
    children: {},
    content: 'elements',
    req: 'R12.3',
  },
  'xsf:membership': {
    attrs: {},
    children: {
      'xsf:getUserNameFromData': 'xsf:getUserNameFromData',
      'xsf:group': 'xsf:group',
      'xsf:userName': 'xsf:userName',
    },
    content: 'elements',
    req: 'R12.3',
  },
  'xsf:userName': {
    attrs: { memberOf: S, name: S },
    children: {},
    content: 'elements',
    req: 'R12.3',
  },
  'xsf:group': {
    attrs: { memberOf: S, name: S },
    children: {},
    content: 'elements',
    req: 'R12.3',
  },
  'xsf:getUserNameFromData': {
    attrs: { dataObject: S, memberOf: S, select: S },
    children: {},
    content: 'elements',
    req: 'R12.3',
  },
  // R12.4
  'xsf2:managedCode': {
    attrs: { enabled: Y, language: S, projectPath: S, version: S },
    children: {},
    content: 'elements',
    req: 'R12.4',
  },
  'xsf:scripts': {
    attrs: { enforceScriptTimeout: Y, language: S },
    children: { 'xsf:script': 'xsf:script' },
    content: 'elements',
    req: 'R12.4',
  },
  'xsf:script': {
    attrs: { src: S },
    children: {},
    content: 'elements',
    req: 'R12.4',
  },
  // R12.5
  'xsf:permissions': {
    attrs: {},
    children: { 'xsf:allowedControl': 'xsf:allowedControl' },
    content: 'elements',
    req: 'R12.5',
  },
  'xsf:allowedControl': {
    attrs: { cabFile: S, clsid: S, version: S },
    children: {},
    content: 'elements',
    req: 'R12.5',
  },
} as const satisfies Vocabulary;

export type SpecKey = keyof typeof XSF_VOCABULARY;
