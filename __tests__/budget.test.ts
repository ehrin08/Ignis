import { budgetAmountText, formatBudgetCurrency, parseBudgetAmount, summarizeBudget, validateBudgetEntry, validateCategoryName, BudgetEntryInput } from '@/src/domain/budget';

const funds: BudgetEntryInput = { id: 'one', kind: 'funds', amountMinor: 1000, date: '2024-02-29', description: '', categoryId: null };

describe('manual budget rules', () => {
  test('starts at zero and allows a shortfall without resetting by period', () => {
    expect(summarizeBudget([])).toEqual({ fundsMinor: 0, expensesMinor: 0, balanceMinor: 0 });
    expect(summarizeBudget([funds, { ...funds, kind: 'expense', amountMinor: 1200 }])).toEqual({ fundsMinor: 1000, expensesMinor: 1200, balanceMinor: -200 });
  });

  test.each([['0.01', 1], ['10.10', 1010], ['1,25', 125], [' 001.2 ', 120], ['90071992547409.91', Number.MAX_SAFE_INTEGER]])('parses %s as exact centavos', (value, expected) => {
    expect(parseBudgetAmount(value)).toBe(expected);
    expect(parseBudgetAmount(budgetAmountText(expected))).toBe(expected);
  });

  test.each(['', '0', '-1', '1.234', '1,000.00', 'NaN', 'Infinity', '1e3', '90071992547409.92'])('rejects invalid amount %s', (value) => {
    expect(() => parseBudgetAmount(value)).toThrow();
  });

  test('rejects aggregate overflow', () => {
    expect(() => summarizeBudget([{ kind: 'funds', amountMinor: Number.MAX_SAFE_INTEGER }, funds])).toThrow(/total exceeds/);
  });

  test('formats centavos accurately, including negative sub-peso and large balances', () => {
    expect(formatBudgetCurrency(1234, 'en-PH')).toBe('₱12.34');
    expect(formatBudgetCurrency(-1, 'en-PH')).toBe('-₱0.01');
    expect(formatBudgetCurrency(Number.MAX_SAFE_INTEGER, 'en-PH')).toBe('₱90,071,992,547,409.91');
  });

  test('validates local calendar dates including leap years and future entries', () => {
    expect(() => validateBudgetEntry(funds, '2024-02-29')).not.toThrow();
    for (const date of ['2023-02-29', '2024-04-31', 'not a date', '2024-2-01', '2024-03-01']) {
      expect(() => validateBudgetEntry({ ...funds, date }, '2024-02-29')).toThrow();
    }
  });

  test('requires positive safe centavos and categories only on expenses', () => {
    for (const amountMinor of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => validateBudgetEntry({ ...funds, amountMinor })).toThrow();
    }
    expect(() => validateBudgetEntry({ ...funds, kind: 'expense' })).toThrow(/category/);
    expect(() => validateBudgetEntry({ ...funds, categoryId: 'food' })).toThrow(/category/);
    expect(() => validateBudgetEntry({ ...funds, description: 'x'.repeat(501) })).toThrow(/500/);
  });

  test('validates category names', () => {
    expect(validateCategoryName('  Groceries  ')).toBe('Groceries');
    expect(() => validateCategoryName('  ')).toThrow();
    expect(() => validateCategoryName('a'.repeat(41))).toThrow();
  });
});
