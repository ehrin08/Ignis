import { blockingDutiesForSchedule, isDutyDateTaken, takenDutyDates } from '@/src/domain/duty-dates';
import { ScheduleInput } from '@/src/types';

import { duty } from '@/test-utils/fixtures';

const input: ScheduleInput = {
  dutyId: 'selected', seriesId: 'series-1', scope: 'future', recurrence: 'daily',
  startDate: '2026-08-25', endDate: null, weekdayMask: [], startMinutes: 540, endMinutes: 1020,
  timezone: 'Asia/Manila', breakSeconds: 0, rateOverride: null, note: '',
};

describe('duty date availability', () => {
  const selected = duty('2026-08-25T09:00:00+08:00', '2026-08-25T17:00:00+08:00', { id: 'selected', seriesId: 'series-1' });
  const futurePending = duty('2026-08-26T09:00:00+08:00', '2026-08-26T17:00:00+08:00', { id: 'pending', seriesId: 'series-1' });
  const futureCompleted = duty('2026-08-27T09:00:00+08:00', '2026-08-27T17:00:00+08:00', { id: 'completed', seriesId: 'series-1', status: 'completed' });
  const unrelated = duty('2026-08-28T09:00:00+08:00', '2026-08-28T17:00:00+08:00', { id: 'other' });

  test('future edits release only pending occurrences that will be replaced', () => {
    expect(blockingDutiesForSchedule(input, [selected, futurePending, futureCompleted, unrelated]).map((item) => item.id)).toEqual(['completed', 'other']);
  });

  test('keeps decided and unrelated dates disabled while enabling the selected date', () => {
    const dates = takenDutyDates(input, [selected, futurePending, futureCompleted, unrelated]);
    expect(dates.has('2026-08-25')).toBe(false);
    expect(dates.has('2026-08-26')).toBe(false);
    expect(dates.has('2026-08-27')).toBe(true);
    expect(dates.has('2026-08-28')).toBe(true);
  });

  test('checks date occupancy independently of time overlap', () => {
    expect(isDutyDateTaken('2026-08-28', [unrelated])).toBe(true);
    expect(isDutyDateTaken('2026-08-29', [unrelated])).toBe(false);
  });
});
