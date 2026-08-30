import { validateScheduleInput } from '@/src/domain/validation';
import { ScheduleInput } from '@/src/types';

import { duty } from '@/test-utils/fixtures';

const base: ScheduleInput = {
  scope: 'occurrence',
  recurrence: 'once',
  startDate: '2026-08-25',
  endDate: null,
  weekdayMask: [],
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
  timezone: 'Asia/Manila',
  breakSeconds: 0,
  rateOverride: null,
  note: '',
};

describe('schedule validation', () => {
  test('accepts an overnight duty', () => {
    expect(validateScheduleInput({ ...base, startMinutes: 22 * 60, endMinutes: 6 * 60, breakSeconds: 1800 }, [])).toBeNull();
  });

  test('requires at least one weekday for weekly recurrence', () => {
    expect(validateScheduleInput({ ...base, recurrence: 'weekly' }, [])).toMatch(/weekday/i);
  });

  test('rejects overlapping generated duties', () => {
    const existing = [duty('2026-08-25T09:00:00+08:00', '2026-08-25T17:00:00+08:00')];
    expect(validateScheduleInput({ ...base, startMinutes: 16 * 60, endMinutes: 20 * 60 }, existing)).toMatch(/overlaps/i);
  });

  test('rejects a break as long as the duty', () => {
    expect(validateScheduleInput({ ...base, startMinutes: 9 * 60, endMinutes: 10 * 60, breakSeconds: 3600 }, [])).toMatch(/shorter/i);
  });

  test('rejects invalid and reversed recurrence dates', () => {
    expect(validateScheduleInput({ ...base, startDate: '2026-02-30' }, [])).toMatch(/valid start/i);
    expect(validateScheduleInput({ ...base, recurrence: 'daily', endDate: '2026-08-20' }, [])).toMatch(/before/i);
  });

  test('rejects invalid rate overrides', () => {
    expect(validateScheduleInput({ ...base, rateOverride: { type: 'day', amountMinor: 0 } }, [])).toMatch(/greater than zero/i);
    expect(validateScheduleInput({ ...base, rateOverride: { type: 'shift', amountMinor: 10_000 } } as never, [])).toMatch(/valid rate override type/i);
  });
});
