import { readFileSync } from 'node:fs';
import { buildFormIR, parseXsn, type FormIR } from '@afterlife/core';

const ROOT = new URL('../../../samples/', import.meta.url);
export const OWN_08 = [
  '01-leave-request',
  '02-expense-report',
  '03-travel-request',
  '04-purchase-request',
  '05-new-hire-onboarding',
  '06-safety-incident',
  '07-leave-request-v2',
  '08-big-form',
] as const;

export async function irOf(slug: string): Promise<FormIR> {
  const path =
    slug === 'theill-weight-keeper'
      ? 'public/theill-weight-keeper/theill__weight-keeper.xsn'
      : `own/xsn/${slug}.xsn`;
  return buildFormIR(await parseXsn(readFileSync(new URL(path, ROOT))));
}
