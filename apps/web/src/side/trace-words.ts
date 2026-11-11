// Spec 15 R2.1: the Rule Trace's wording lives in core, shared with the form dossier. The page
// imports it through its own package export: it holds plain functions over FormIR and type
// imports only, so no core runtime enters the page (spec 09 design §1).
export { fieldName, traceExpression, tracePaths, traceSentence } from '@afterlife/core/words';
