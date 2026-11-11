// Spec 21: the landing page's tasks. Each opens a bundled sample at the screen that does it, has
// an address (`#<id>` on the app's own URL) and one line on what to try first.
export type TaskId = 'read' | 'rules' | 'fill' | 'find' | 'keep' | 'document' | 'triage';

export interface Task {
  readonly id: TaskId;
  /** A sample id, or `all` for every sample in Triage. */
  readonly sample: string;
  readonly label: string;
  readonly hint: string;
}

export const TASKS: readonly Task[] = [
  {
    id: 'read',
    sample: '02-expense-report',
    label: 'Read an old form and its records the way InfoPath showed them',
    hint: 'This is record 1 of 30, drawn as InfoPath drew it. Choose Next to read the next one.',
  },
  {
    id: 'rules',
    sample: '04-purchase-request',
    label: 'See the rules and calculations behind a field',
    hint: 'Choose any field on the form to see its rules and where its value comes from.',
  },
  {
    id: 'fill',
    sample: '04-purchase-request',
    label: 'Fill in a form and see why each value changed',
    hint: 'Change Qty in the first row of Items, then read what happened in Rule Trace.',
  },
  {
    id: 'find',
    sample: '02-expense-report',
    label: 'Find one record among many, and total them',
    hint: 'Type a name or an amount in Find, or choose Summarize to total the records by department.',
  },
  {
    id: 'keep',
    sample: '05-new-hire-onboarding',
    label: 'Keep old records readable without InfoPath',
    hint: 'Choose a workbook, CSV files, or web pages that open in any browser, with no InfoPath.',
  },
  {
    id: 'document',
    sample: '04-purchase-request',
    label: 'Print what a form does, for whoever takes it over',
    hint: 'Choose Print for a paper copy, or Download Markdown to put it in a wiki.',
  },
  {
    id: 'triage',
    sample: 'all',
    label: 'Decide which forms can move first',
    // Spec 22 F9: the Triage table does not sort; the line promised it did.
    hint: 'One row per form, with its wave. Open a form’s death certificate to see what stops it.',
  },
];

/** The task an address names, or `undefined` for anything else (R6: says nothing). */
export const taskOf = (hash: string): Task | undefined => TASKS.find((t) => `#${t.id}` === hash);
