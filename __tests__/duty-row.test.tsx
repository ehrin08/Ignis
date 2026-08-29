import { render } from '@testing-library/react-native';

import { DutyRow } from '@/src/components/duty-row';
import { duty } from '@/test-utils/fixtures';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

describe('DutyRow', () => {
  test('offers attendance decisions only after a pending duty ends', async () => {
    const onStatus = jest.fn();
    const ended = duty('2026-08-24T09:00:00Z', '2026-08-24T17:00:00Z');
    const result = await render(
      <DutyRow currencyCode="USD" duty={ended} now={ended.scheduledEnd! + 1} onPress={jest.fn()} onStatus={onStatus} />,
    );
    expect(result.getByText('Complete')).toBeTruthy();
    expect(result.getByText('Mark AWOL')).toBeTruthy();
  });

  test('shows a non-color completed label and no review controls', async () => {
    const completed = duty('2026-08-24T09:00:00Z', '2026-08-24T17:00:00Z', { status: 'completed' });
    const result = await render(
      <DutyRow currencyCode="USD" duty={completed} grossMinor={16_000} now={completed.scheduledEnd! + 1} onPress={jest.fn()} />,
    );
    expect(await result.findByText('Completed')).toBeTruthy();
    expect(result.queryByText('Mark AWOL')).toBeNull();
  });
});
