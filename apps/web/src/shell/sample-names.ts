/** `02-expense-report` → `Expense report`; `theill-weight-keeper` → `Weight keeper`. */
export const sampleName = (id: string) => {
  const words = id.replace(/^\d+-|^theill-/, '').replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const recordCount = (n: number) =>
  n === 0 ? 'No records' : n === 1 ? '1 record' : `${n} records`;
