import { generateOccurrences, materializationEnd, scheduledRange, seriesFromInput, wallClockDate } from '@/src/domain/schedule';
import { ScheduleInput } from '@/src/types';

import { weeklySeries } from '@/test-utils/fixtures';

describe('schedule recurrence', () => {
  test('generates only selected weekdays', () => {
    const duties = generateOccurrences(weeklySeries, '2026-08-24', '2026-08-31');
    expect(duties.map((duty) => duty.occurrenceDate)).toEqual(['2026-08-24', '2026-08-26', '2026-08-28']);
  });

  test('honors an inclusive recurrence end date', () => {
    const duties = generateOccurrences({ ...weeklySeries, recurrence: 'daily', endDate: '2026-08-26' }, '2026-08-24', '2026-09-01');
    expect(duties.map((duty) => duty.occurrenceDate)).toEqual(['2026-08-24', '2026-08-25', '2026-08-26']);
  });

  test('creates an overnight scheduled range', () => {
    const range = scheduledRange('2026-08-24', 22 * 60, 6 * 60);
    expect(range.end - range.start).toBe(8 * 3_600_000);
    expect(new Date(range.end).getDate()).not.toBe(new Date(range.start).getDate());
  });

  test('keeps calendar times stable while generating across a DST boundary', () => {
    const input: ScheduleInput = {
      scope: 'occurrence', recurrence: 'daily', startDate: '2026-03-07', endDate: '2026-03-10',
      weekdayMask: [], startMinutes: 9 * 60, endMinutes: 17 * 60, timezone: 'America/New_York', breakSeconds: 0, note: '',
      rateOverride: null,
    };
    const duties = generateOccurrences(seriesFromInput(input, 'dst'), '2026-03-07', '2026-03-11');
    expect(duties).toHaveLength(4);
    expect(new Date(duties[0].scheduledStart).toISOString()).toBe('2026-03-07T14:00:00.000Z');
    expect(new Date(duties[1].scheduledStart).toISOString()).toBe('2026-03-08T13:00:00.000Z');
    expect(duties.every((duty) => duty.scheduledEnd! - duty.scheduledStart === 8 * 3_600_000)).toBe(true);
  });

  test('copies a rate override to each generated duty', () => {
    const rateOverride = { type: 'day' as const, amountMinor: 18_000 };
    const duties = generateOccurrences({ ...weeklySeries, rateOverride }, '2026-08-24', '2026-08-31');
    expect(duties.map((duty) => duty.rateOverride)).toEqual([rateOverride, rateOverride, rateOverride]);
  });

  test('uses the series semantic timestamps for generated duties', () => {
    const duties = generateOccurrences({ ...weeklySeries, createdAt: 100, updatedAt: 250 }, '2026-08-24', '2026-08-31');
    expect(duties.every((duty) => duty.createdAt === 100 && duty.updatedAt === 250)).toBe(true);
  });

  test('materializes at least one occurrence for a far-future one-off duty', () => {
    expect(materializationEnd({ startDate: '2030-04-15', endDate: '2030-04-15' }, new Date('2026-08-30T00:00:00Z'))).toBe('2030-04-16');
  });

  test('recovers the originating wall-clock time independently of the device timezone', () => {
    const instant = Date.parse('2026-08-24T13:30:00.000Z');
    const newYork = wallClockDate(instant, 'America/New_York');
    const manila = wallClockDate(instant, 'Asia/Manila');
    expect([newYork.getHours(), newYork.getMinutes()]).toEqual([9, 30]);
    expect([manila.getHours(), manila.getMinutes()]).toEqual([21, 30]);
  });
});
