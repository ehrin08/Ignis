import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { DutyDatePicker, calendarMonthCells } from '@/src/components/duty-date-picker';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

describe('duty date picker', () => {
  test('builds complete calendar weeks for a month', () => {
    const cells = calendarMonthCells(new Date(2026, 7, 1));
    expect(cells).toHaveLength(42);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });

  test('does not select an unavailable date', async () => {
    const onSelect = jest.fn();
    const result = await render(
      <DutyDatePicker
        disabledDates={new Set(['2026-08-25'])}
        onDismiss={jest.fn()}
        onSelect={onSelect}
        value="2026-08-24"
        visible
      />,
    );
    const unavailable = result.getByRole('button', { name: /August 25, 2026, unavailable/i });
    expect(unavailable.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(unavailable);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(result.getByRole('button', { name: /August 26, 2026/i }));
    expect(onSelect).toHaveBeenCalledWith('2026-08-26');
  });

  test('navigates between months', async () => {
    const result = await render(
      <DutyDatePicker disabledDates={new Set()} onDismiss={jest.fn()} onSelect={jest.fn()} value="2026-08-24" visible />,
    );
    fireEvent.press(result.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(result.getByText('September 2026')).toBeTruthy());
  });
});
