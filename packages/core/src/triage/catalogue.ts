// Spec 12 R2, design §4, D5: the causes of death. Three carry a date and a source, each checked
// by the human on 2026-11-11; the others are dated "—" because nothing dates them. Replacements
// are the brief's, except `code-behind` (`Changed at review (2026-11-11):` Manual, decision 2).

export type CauseId =
  | 'forms-services-spo'
  | 'infopath-client'
  | 'browser-xslt'
  | 'internal-sql'
  | 'internal-service'
  | 'code-behind'
  | 'activex'
  | 'signatures';

/** Catalogue order: the order causes are listed on a certificate and in the CSV. */
export const CAUSE_IDS: readonly CauseId[] = [
  'forms-services-spo',
  'infopath-client',
  'browser-xslt',
  'internal-sql',
  'internal-service',
  'code-behind',
  'activex',
  'signatures',
];

export interface CauseInfo {
  readonly id: CauseId;
  /** ISO date; absent means "—". */
  readonly date?: string;
  /** The date as the certificate shows it. */
  readonly dateWords: string;
  readonly source?: { readonly title: string; readonly url: string };
  readonly replacement: string;
}

export const WORKFLOW_LINE =
  'Workflows attached outside the form cannot be detected from the file. Ask the library owner.';

export const CAUSES: Readonly<Record<CauseId, CauseInfo>> = {
  'forms-services-spo': {
    id: 'forms-services-spo',
    date: '2026-07-14',
    dateWords: 'after July 14, 2026',
    source: {
      title: 'Microsoft: Support update for InfoPath Forms Services in Microsoft 365 (June 2023)',
      url: 'https://techcommunity.microsoft.com/t5/microsoft-sharepoint-blog/support-update-for-infopath-forms-services-in-microsoft-365/ba-p/3858190',
    },
    replacement: 'JSM portal: native Forms or Classic mode',
  },
  'infopath-client': {
    id: 'infopath-client',
    date: '2026-07-14',
    dateWords: 'after July 14, 2026 (extended support ends 7/15/2026 6:59:59 AM Pacific)',
    source: {
      title: 'Microsoft Lifecycle: InfoPath 2013',
      url: 'https://learn.microsoft.com/en-us/lifecycle/products/infopath-2013',
    },
    replacement: 'Classic mode in any browser',
  },
  'browser-xslt': {
    id: 'browser-xslt',
    date: '2026-11-17',
    dateWords:
      'Chrome 158, November 17, 2026 (Origin Trial and Enterprise Policy until Chrome 176, August 17, 2027)',
    source: {
      title: 'Chrome for Developers: Deprecating XSLT',
      url: 'https://developer.chrome.com/docs/web-platform/deprecating-xslt',
    },
    replacement: 'Original view panel / web viewer render',
  },
  'internal-sql': {
    id: 'internal-sql',
    dateWords: '—',
    replacement: 'Manual: needs a REST source or an Assets lookup',
  },
  'internal-service': {
    id: 'internal-service',
    dateWords: '—',
    replacement: 'Manual: rebind or replace with a JSM field',
  },
  'code-behind': {
    id: 'code-behind',
    dateWords: '—',
    replacement:
      'Manual: the logic must be rewritten by hand. The event names it handled are listed.',
  },
  activex: { id: 'activex', dateWords: '—', replacement: 'Unsupported: listed' },
  signatures: {
    id: 'signatures',
    dateWords: '—',
    replacement: 'Signer names and times shown as text, "not re-verified"',
  },
};
