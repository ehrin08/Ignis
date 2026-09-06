import { localDateKey } from '@/src/domain/format';

export const BUDGET_CURRENCY = 'PHP';
export const BUDGET_BACKUP_NOTICE = 'Budget is stored on this device and is not included in account backup';
export const DEFAULT_BUDGET_CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Other'] as const;

export type BudgetKind = 'funds' | 'expense';
export type BudgetCategory = { id: string; name: string; archived: boolean; createdAt: number; updatedAt: number };
export type BudgetEntryInput = {
  id: string;
  kind: BudgetKind;
  amountMinor: number;
  date: string;
  description: string;
  categoryId: string | null;
};
export type BudgetEntry = BudgetEntryInput & { createdAt: number; updatedAt: number };

/** Parse decimal text directly into centavos, without floating-point rounding. */
export function parseBudgetAmount(value: string): number {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole, fraction = ''] = text.split(/[.,]/);
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error('Enter a positive amount within the supported range.');
  return minor;
}

export function budgetAmountText(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

/** Keep centavos exact even when a large peso value cannot represent hundredths. */
export function formatBudgetCurrency(minor: number, locale?: string): string {
  const fraction = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(Math.abs(minor) % 100);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: BUDGET_CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .formatToParts(Math.trunc(minor / 100))
    .map((part) => part.type === 'fraction' ? fraction : part.value).join('');
}

export function validateBudgetEntry(input: BudgetEntryInput, today = localDateKey(new Date())): void {
  if (!input.id.trim()) throw new Error('The budget entry needs an ID.');
  if (input.kind !== 'funds' && input.kind !== 'expense') throw new Error('Choose funds or expense.');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Enter a positive amount within the supported range.');
  const date = new Date(`${input.date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(date.getTime()) || localDateKey(date) !== input.date) {
    throw new Error('Enter a valid calendar date.');
  }
  if (input.date > today) throw new Error('Choose today or a past date for an actual transaction.');
  if (input.description.length > 500) throw new Error('Keep the description to 500 characters or fewer.');
  if (input.kind === 'expense' && !input.categoryId) throw new Error('Choose an expense category.');
  if (input.kind === 'funds' && input.categoryId !== null) throw new Error('Funds do not have an expense category.');
}

export function validateCategoryName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 40) throw new Error('Enter a category name between 1 and 40 characters.');
  return name;
}

export function summarizeBudget(entries: readonly Pick<BudgetEntry, 'kind' | 'amountMinor'>[]) {
  let fundsMinor = 0;
  let expensesMinor = 0;
  for (const entry of entries) {
    if (entry.kind === 'funds') fundsMinor += entry.amountMinor;
    else expensesMinor += entry.amountMinor;
    if (!Number.isSafeInteger(fundsMinor) || !Number.isSafeInteger(expensesMinor)) {
      throw new Error('The budget total exceeds the supported range. Reduce the amount.');
    }
  }
  return { fundsMinor, expensesMinor, balanceMinor: fundsMinor - expensesMinor };
}
