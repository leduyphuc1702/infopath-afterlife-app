// Spec 12: the words the Triage screens show. The main thread imports core types only (spec 09
// design §1), so the strings core exports are repeated here; `test/words.test.ts` checks they
// are equal to core's.
import type { CauseId, Wave } from '@afterlife/core';

export const WAVE_RULES: Readonly<Record<Wave, string>> = {
  1: 'Wave 1: everything converts to native Jira Service Management features.',
  2: 'Wave 2: some parts are emulated by Afterlife (Classic mode); nothing is manual or unsupported.',
  3: 'Wave 3: at least one part is manual or unsupported.',
};

export const WORKFLOW_LINE =
  'Workflows attached outside the form cannot be detected from the file. Ask the library owner.';

/** Decision 8 (2026-11-11): users see "Emulated", with this tooltip. */
export const EMULATED_TOOLTIP = 'Afterlife runs it in Classic mode';

/** A cause's title on the certificate; its id is shown beside it. */
export const CAUSE_TITLES: Readonly<Record<CauseId, string>> = {
  'forms-services-spo': 'InfoPath Forms Services removed from SharePoint Online',
  'infopath-client': 'InfoPath 2013 is out of support',
  'browser-xslt': 'Browsers stop drawing the record with XSLT',
  'internal-sql': 'Database on an internal server',
  'internal-service': 'Service on an internal host',
  'code-behind': 'Code-behind',
  activex: 'ActiveX control',
  signatures: 'Digital signatures',
};

const PREFIXES: Readonly<Record<string, string>> = {
  'http://www.w3.org/1999/XSL/Transform': 'xsl:',
  'http://schemas.microsoft.com/office/infopath/2003': 'xd:',
};

/** FormIR writes `{uri}local` steps for view XSL; the certificate shows the usual prefixes. */
export const shortPath = (path: string) =>
  path.replace(/\{([^}]*)\}/g, (_m, uri: string) => PREFIXES[uri] ?? '');

/** Review 2026-11-11: the Triage chips show these; the id is in the tooltip and the CSV. */
export const CAUSE_SHORT: Readonly<Record<CauseId, string>> = {
  'forms-services-spo': 'Forms Services',
  'infopath-client': 'InfoPath 2013',
  'browser-xslt': 'Browser XSLT',
  'internal-sql': 'Internal SQL',
  'internal-service': 'Internal service',
  'code-behind': 'Code-behind',
  activex: 'ActiveX',
  signatures: 'Signatures',
};
