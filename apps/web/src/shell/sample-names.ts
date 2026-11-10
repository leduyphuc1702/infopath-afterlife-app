/** `02-expense-report` → `Expense report`; `theill-weight-keeper` → `Weight keeper`. */
export const sampleName = (id: string) => {
  const words = id.replace(/^\d+-|^theill-/, '').replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The second line of a sample button: its record count, or its author for third-party ones. */
export const sampleDetail = (id: string, records: number) =>
  id.startsWith('theill-')
    ? 'by Peter Theill'
    : records === 0
      ? ''
      : records === 1
        ? '1 record'
        : `${records} records`;
