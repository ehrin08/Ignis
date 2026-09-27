import { findNextUpcomingDuty, findOverdueDuties } from '@/src/domain/schedule';
import { duty } from '@/test-utils/fixtures';

describe('findNextUpcomingDuty', () => {
  const now = new Date('2026-09-27T10:00:00Z');

  test('returns the nearest future pending duty', () => {
    const duties = [
      duty('2026-09-27T08:00:00Z', '2026-09-27T16:00:00Z', { status: 'completed' }),
      duty('2026-09-28T07:00:00Z', '2026-09-28T15:00:00Z'),
      duty('2026-09-29T07:00:00Z', '2026-09-29T15:00:00Z'),
    ];
    const next = findNextUpcomingDuty(duties, now);
    expect(next?.occurrenceDate).toBe('2026-09-28');
  });

  test('returns null when no future pending duties exist', () => {
    const duties = [
      duty('2026-09-26T08:00:00Z', '2026-09-26T16:00:00Z', { status: 'completed' }),
      duty('2026-09-27T07:00:00Z', '2026-09-27T09:00:00Z', { status: 'pending' }),
    ];
    expect(findNextUpcomingDuty(duties, now)).toBeNull();
  });

  test('returns null for empty duty list', () => {
    expect(findNextUpcomingDuty([], now)).toBeNull();
  });

  test('ignores AWOL duties', () => {
    const duties = [
      duty('2026-09-28T07:00:00Z', '2026-09-28T15:00:00Z', { status: 'awol' }),
      duty('2026-09-29T07:00:00Z', '2026-09-29T15:00:00Z'),
    ];
    const next = findNextUpcomingDuty(duties, now);
    expect(next?.occurrenceDate).toBe('2026-09-29');
  });
});

describe('findOverdueDuties', () => {
  const now = new Date('2026-09-27T18:00:00Z');

  test('finds pending duties whose end has passed', () => {
    const duties = [
      duty('2026-09-27T07:00:00Z', '2026-09-27T15:00:00Z'), // ended at 15:00, now is 18:00 → overdue
      duty('2026-09-27T16:00:00Z', '2026-09-27T20:00:00Z'), // ends at 20:00, not yet → not overdue
      duty('2026-09-28T07:00:00Z', '2026-09-28T15:00:00Z'), // future → not overdue
    ];
    const overdue = findOverdueDuties(duties, now);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].occurrenceDate).toBe('2026-09-27');
  });

  test('excludes completed and AWOL duties', () => {
    const duties = [
      duty('2026-09-27T07:00:00Z', '2026-09-27T15:00:00Z', { status: 'completed' }),
      duty('2026-09-26T07:00:00Z', '2026-09-26T15:00:00Z', { status: 'awol' }),
    ];
    expect(findOverdueDuties(duties, now)).toHaveLength(0);
  });

  test('excludes duties with no scheduled end', () => {
    const duties = [
      duty('2026-09-27T07:00:00Z', null),
    ];
    expect(findOverdueDuties(duties, now)).toHaveLength(0);
  });
});
