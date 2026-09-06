import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usePreventRemove } from '@react-navigation/native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { BudgetCategoryEditor } from '@/src/components/budget-categories';
import { BudgetEntryEditor } from '@/src/components/budget-entry-editor';
import { BudgetScreen } from '@/src/components/budget-screen';
import { BUDGET_BACKUP_NOTICE, BudgetCategory, BudgetEntry } from '@/src/domain/budget';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));
const mockScheme = jest.fn(() => 'light');
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'new-id') }));
jest.mock('@react-native-community/datetimepicker', () => jest.fn(() => null));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
const mockDispatch = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: mockDispatch }), usePreventRemove: jest.fn() }));
const mockConfirm = jest.fn();
jest.mock('@/src/providers/feedback-provider', () => ({ useConfirm: () => mockConfirm, useToast: () => ({ success: jest.fn() }) }));

const mockBudget = {
  entries: [] as BudgetEntry[],
  categories: [] as BudgetCategory[],
  totals: { fundsMinor: 0, expensesMinor: 0, balanceMinor: 0 },
  loading: false, error: null as string | null,
  refresh: jest.fn(), saveEntry: jest.fn(), deleteEntry: jest.fn(), saveCategory: jest.fn(), archiveCategory: jest.fn(),
};
jest.mock('@/src/providers/budget-provider', () => ({ useBudget: () => mockBudget }));
const food: BudgetCategory = { id: 'food', name: 'Food', archived: false, createdAt: 0, updatedAt: 0 };
const existing: BudgetEntry = { id: 'expense', kind: 'expense', amountMinor: 12500, date: '2020-01-01', description: 'Lunch', categoryId: 'food', createdAt: 0, updatedAt: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  mockScheme.mockReturnValue('light');
  mockBudget.entries = [];
  mockBudget.categories = [food, { ...food, id: 'other', name: 'Other' }];
  mockBudget.totals = { fundsMinor: 0, expensesMinor: 0, balanceMinor: 0 };
  mockBudget.loading = false;
  mockBudget.error = null;
  mockBudget.saveEntry.mockResolvedValue(undefined);
  mockBudget.deleteEntry.mockResolvedValue(undefined);
  mockBudget.saveCategory.mockResolvedValue(undefined);
  mockBudget.archiveCategory.mockResolvedValue(undefined);
  mockConfirm.mockResolvedValue(false);
});

test('empty budget shows its local-only notice and separate entry actions', async () => {
  const result = await render(<BudgetScreen />);
  expect(result.getByText('Your ledger starts here')).toBeTruthy();
  expect(result.getByText(`${BUDGET_BACKUP_NOTICE}.`)).toBeTruthy();
  await fireEvent.press(result.getByRole('button', { name: 'Add funds' }));
  expect(router.push).toHaveBeenCalledWith('/budget/entry/new?kind=funds');
  await fireEvent.press(result.getByRole('button', { name: 'Add expense' }));
  expect(router.push).toHaveBeenCalledWith('/budget/entry/new?kind=expense');
});

test('renders shortfall and accessible transaction editing', async () => {
  mockBudget.entries = [existing];
  mockBudget.totals = { fundsMinor: 0, expensesMinor: 12500, balanceMinor: -12500 };
  const result = await render(<BudgetScreen />);
  expect(result.getByText(/Shortfall/)).toBeTruthy();
  await fireEvent.press(result.getByRole('button', { name: /Edit expense, Food/ }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/budget/entry/[id]', params: { id: 'expense' } });
});

test.each(['light', 'dark'])('keeps balance and transaction labels accessible in %s mode', async (scheme) => {
  mockScheme.mockReturnValue(scheme);
  mockBudget.entries = [existing];
  const result = await render(<BudgetScreen />);
  const balance = result.getByLabelText(/Available balance/);
  expect(balance.props.maxFontSizeMultiplier).toBe(1.35);
  expect(result.getByRole('button', { name: /Edit expense, Food/ })).toBeTruthy();
  expect(result.getByText('Available balance').props.maxFontSizeMultiplier).toBe(1.6);
});

test('Android uses the native date picker and saves its local calendar date', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  try {
    const result = await render(<BudgetEntryEditor id="new" kind="funds" />);
    await fireEvent.press(result.getByRole('button', { name: /^Date:/ }));
    const calls = (DateTimePicker as unknown as jest.Mock).mock.calls;
    const pickerProps = calls[calls.length - 1][0];
    expect(pickerProps.maximumDate).toBeInstanceOf(Date);
    await act(() => pickerProps.onChange({ type: 'set' }, new Date(2020, 1, 29)));
    await fireEvent.changeText(result.getByLabelText('Amount in PHP'), '1.00');
    await fireEvent.press(result.getByRole('button', { name: 'Save entry' }));
    expect(mockBudget.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ date: '2020-02-29' }), false);
  } finally { platform.restore(); }
});

test('shows loading and retry instead of allowing edits after initial read failure', async () => {
  mockBudget.loading = true;
  const result = await render(<BudgetScreen />);
  expect(result.getByText('Loading budget…')).toBeTruthy();
  mockBudget.loading = false;
  mockBudget.categories = [];
  mockBudget.error = 'Database unavailable';
  mockBudget.refresh.mockResolvedValue(undefined);
  await result.rerender(<BudgetScreen />);
  expect(result.queryByText('Add funds')).toBeNull();
  await fireEvent.press(result.getByRole('button', { name: 'Try budget again' }));
  expect(mockBudget.refresh).toHaveBeenCalledTimes(1);
});

test('validates amounts, keeps failed-save input, and retries with the same transaction ID', async () => {
  const result = await render(<BudgetEntryEditor id="new" kind="funds" />);
  await fireEvent.changeText(result.getByLabelText('Amount in PHP'), '1.234');
  await fireEvent.press(result.getByRole('button', { name: 'Save entry' }));
  expect(mockBudget.saveEntry).not.toHaveBeenCalled();
  expect(result.getByText(/at most two decimal/)).toBeTruthy();
  await fireEvent.changeText(result.getByLabelText('Amount in PHP'), '12.34');
  mockBudget.saveEntry.mockRejectedValueOnce(new Error('Disk full'));
  await fireEvent.press(result.getByRole('button', { name: 'Save entry' }));
  expect(await result.findByText('Disk full')).toBeTruthy();
  expect(result.getByLabelText('Amount in PHP').props.value).toBe('12.34');
  expect(router.back).not.toHaveBeenCalled();
  await fireEvent.press(result.getByRole('button', { name: 'Save entry' }));
  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockBudget.saveEntry.mock.calls.map(([entry]) => entry.id)).toEqual(['new-id', 'new-id']);
  expect(mockBudget.saveEntry).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'funds', amountMinor: 1234, categoryId: null }), false);
});

test('guards system Back and respects keep editing or discard', async () => {
  const result = await render(<BudgetEntryEditor id="new" kind="funds" />);
  await fireEvent.changeText(result.getByLabelText('Description'), 'Unsaved');
  const calls = (usePreventRemove as jest.Mock).mock.calls;
  const [enabled, handler] = calls[calls.length - 1];
  expect(enabled).toBe(true);
  const data = { action: { type: 'GO_BACK' } };
  await act(() => handler({ data }));
  expect(mockDispatch).not.toHaveBeenCalled();
  mockConfirm.mockResolvedValueOnce(true);
  await act(() => handler({ data }));
  expect(mockDispatch).toHaveBeenCalledWith(data.action);
});

test('deletion requires confirmation', async () => {
  mockBudget.entries = [existing];
  const result = await render(<BudgetEntryEditor id="expense" kind="expense" />);
  await fireEvent.press(result.getByRole('button', { name: 'Delete entry' }));
  expect(mockBudget.deleteEntry).not.toHaveBeenCalled();
  mockConfirm.mockResolvedValueOnce(true);
  await fireEvent.press(result.getByRole('button', { name: 'Delete entry' }));
  await waitFor(() => expect(mockBudget.deleteEntry).toHaveBeenCalledWith('expense'));
});

test('archived category remains selectable on its existing expense only', async () => {
  mockBudget.categories[0] = { ...food, archived: true };
  mockBudget.entries = [existing];
  const result = await render(<BudgetEntryEditor id="expense" kind="expense" />);
  expect(result.getByRole('radio', { name: 'Food (archived)' })).toBeTruthy();
  await result.unmount();
  const fresh = await render(<BudgetEntryEditor id="new" kind="expense" />);
  expect(fresh.queryByText('Food (archived)')).toBeNull();
});

test('category save errors remain visible and archive requires confirmation', async () => {
  const result = await render(<BudgetCategoryEditor id="food" />);
  await fireEvent.press(result.getByRole('button', { name: 'Archive category' }));
  expect(mockBudget.archiveCategory).not.toHaveBeenCalled();
  mockConfirm.mockResolvedValueOnce(true);
  await fireEvent.press(result.getByRole('button', { name: 'Archive category' }));
  await waitFor(() => expect(mockBudget.archiveCategory).toHaveBeenCalledWith('food', true));
  mockBudget.saveCategory.mockRejectedValueOnce(new Error('A category with this name already exists'));
  await fireEvent.changeText(result.getByLabelText('Category name'), 'Other');
  await fireEvent.press(result.getByRole('button', { name: 'Save category' }));
  expect(await result.findByText(/already exists/)).toBeTruthy();
});
