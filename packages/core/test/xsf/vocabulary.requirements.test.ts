import { expect, test } from 'vitest';
import { MS_IPFF2 } from '../../src/xsf/ms-ipff2';
import { XSF_VOCABULARY } from '../../src/xsf/vocabulary';

// Design §8.5: every element R7–R12 and R21.2 name is a table key with that requirement id. The list is
// copied from requirements.md by hand, so a table edit cannot silently drop a requirement item.

const NAMED: Record<string, readonly string[]> = {
  'R7.1': ['xsf:xDocumentClass'],
  'R7.2': ['xsf2:solutionDefinition', 'xsf2:server', 'xsf2:offline'],
  'R7.3': ['xsf:documentVersionUpgrade', 'xsf:useTransform'],
  'R7.4': [
    'xsf:fileNew',
    'xsf:initialXmlDocument',
    'xsf:documentSchemas',
    'xsf:package',
    'xsf:files',
    'xsf:fileProperties',
    'xsf:importParameters',
    'xsf:applicationParameters',
    'xsf:solutionProperties',
  ],
  'R8.1': ['xsf:views', 'xsf:view', 'xsf:mainpane'],
  'R8.2': [
    'xsf:printSettings',
    'xsf:header',
    'xsf:footer',
    'xsf2:viewExtension',
    'xsf2:mergedPrintView',
    'xsf3:viewExtension',
  ],
  'R8.3': ['xsf:xmlToEdit', 'xsf:editWith', 'xsf:fragmentToInsert', 'xsf:chooseFragment'],
  'R8.4': ['xsf:menuArea', 'xsf:toolbar', 'xsf:unboundControls', 'xsf:unboundControls/button'],
  'R9.1': ['xsf:ruleSet', 'xsf:rule'],
  'R9.2': [
    'xsf:assignmentAction',
    'xsf:dialogBoxMessageAction',
    'xsf:dialogBoxExpressionAction',
    'xsf:switchViewAction',
    'xsf:queryAction',
    'xsf:rule/submitAction',
    'xsf:openNewDocumentAction',
    'xsf:closeDocumentAction',
    'xsf:changeAdapterProperty',
    'xsf:webPartConnectionAction',
    'xsf:signSignatureLineAction',
  ],
  'R9.3': ['xsf:rule/exitRuleSet'],
  'R9.4': ['xsf:ruleSetAction', 'xsf:onLoad'],
  'R9.5': ['xsf:domEventHandler'],
  'R10.1': ['xsf:calculatedField'],
  'R10.2': ['xsf:customValidation', 'xsf:errorCondition', 'xsf:errorMessage'],
  'R10.4': ['xsf3:customValidation', 'xsf3:errorBlank', 'xsf:schemaErrorMessages'],
  'R11.1': ['xsf:dataObject', 'xsf:dataObject/query'],
  'R11.2': [
    'xsf:submit',
    'xsf:submit/successMessage',
    'xsf:submit/errorMessage',
    'xsf:dataAdapters',
  ],
  'R11.3': [
    'xsf:xmlFileAdapter',
    'xsf:adoAdapter',
    'xsf:webServiceAdapter',
    'xsf:operation',
    'xsf:input',
    'xsf:sharepointListAdapter',
    'xsf:sharepointListAdapterRW',
    'xsf:davAdapter',
    'xsf:davAdapter/folderURL',
    'xsf:davAdapter/fileName',
    'xsf:emailAdapter',
    'xsf:emailAdapter/to',
    'xsf:emailAdapter/cc',
    'xsf:emailAdapter/bcc',
    'xsf:emailAdapter/subject',
    'xsf:emailAdapter/intro',
    'xsf:emailAdapter/attachmentFileName',
    'xsf:submitToHostAdapter',
    'xsf:bdcAdapter',
    'xsf:hwsAdapter',
    'xsf:useHttpHandler',
    'xsf:useScriptHandler',
    'xsf:useQueryAdapter',
  ],
  'R11.4': ['xsf2:dataConnections', 'xsf2:connectoid'],
  'R12.1': ['xsf:listProperties', 'xsf:fields', 'xsf:field', 'xsf2:listPropertiesExtension'],
  'R12.2': [
    'xsf:documentSignatures',
    'xsf:signedDataBlock',
    'xsf:signedDataBlock/message',
    'xsf3:signatureLines',
  ],
  'R12.3': ['xsf:roles', 'xsf:role', 'xsf:membership'],
  'R12.4': ['xsf2:managedCode', 'xsf:scripts', 'xsf:script'],
  'R12.5': ['xsf:permissions', 'xsf:allowedControl'],
  'R21.2': [
    'xsf:importSource',
    'xsf:menu',
    'xsf:taskpane',
    'xsf2:preview',
    'xsf2:solutionPropertiesExtension',
    'xsf2:admin',
    'xsf2:contentType',
    'xsf2:contentTypeTemplate',
    'xsf2:entity',
    'xsf2:groove',
    'xsf2:install',
    'xsf2:list',
    'xsf2:mail',
    'xsf2:share',
    'xsf2:workflowInitAssoc',
    'xsf2:wss',
    'xsf2:toolbar',
    'xsf2:commands',
    'xsf2:command',
    'xsf2:xmlToEditExtension',
  ],
};

const rows = Object.entries(NAMED).flatMap(([req, keys]) => keys.map((key) => [key, req]));

test.each(rows)('%s is a table key with req %s', (key, req) => {
  expect(XSF_VOCABULARY).toHaveProperty([key]);
  expect(XSF_VOCABULARY[key as keyof typeof XSF_VOCABULARY].req).toBe(req);
});

test('xsf:grooveAdapter (named in R11.3) has no parent position in MS-IPFF2 5.1, so it is not in the table', () => {
  expect(MS_IPFF2['xsf:grooveAdapter']).toBeDefined();
  const parents = Object.entries(MS_IPFF2).filter(([, e]) =>
    e.children.includes('xsf:grooveAdapter'),
  );
  expect(parents).toEqual([]);
  expect(XSF_VOCABULARY).not.toHaveProperty(['xsf:grooveAdapter']);
});
