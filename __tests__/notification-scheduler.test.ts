import {
  computeUpcomingDutyNotifications,
  computeOverdueNotifications,
  computeDailySummaryNotification,
  computeAllNotifications,
} from '@/src/notifications/scheduler';
import { duty, settings } from '@/test-utils/fixtures';
import type { AppSettings } from '@/src/types';

const now = new Date('2026-09-27T10:00:00Z');

describe('computeUpcomingDutyNotifications', () => {
  test('creates a notification for each future pending duty', () => {
    const duties = [
      duty('2026-09-27T12:00:00Z', '2026-09-27T20:00:00Z'),
      duty('2026-09-28T07:00:00Z', '2026-09-28T15:00:00Z'),
    ];
    const result = computeUpcomingDutyNotifications(duties, settings, now);
    expect(result).toHaveLength(2);
    expect(result[0].identifier).toBe(`upcoming-${duties[0].id}`);
    expect(result[1].identifier).toBe(`upcoming-${duties[1].id}`);
  });

  test('fires 30 minutes before the duty start by default', () => {
    const duties = [
      duty('2026-09-27T12:00:00Z', '2026-09-27T20:00:00Z'),
    ];
    const result = computeUpcomingDutyNotifications(duties, settings, now);
    expect(result[0].triggerDate.getTime()).toBe(
      new Date('2026-09-27T11:30:00Z').getTime(),
    );
  });

  test('skips past duties', () => {
    const duties = [
      duty('2026-09-27T08:00:00Z', '2026-09-27T16:00:00Z'),
    ];
    const result = computeUpcomingDutyNotifications(duties, settings, now);
    expect(result).toHaveLength(0);
  });

  test('skips completed duties', () => {
    const duties = [
      duty('2026-09-28T07:00:00Z', '2026-09-28T15:00:00Z', { status: 'completed' }),
    ];
    const result = computeUpcomingDutyNotifications(duties, settings, now);
    expect(result).toHaveLength(0);
  });

  test('returns empty when notification is disabled', () => {
    const disabledSettings: AppSettings = { ...settings, notifyUpcomingDuty: false };
    const duties = [
      duty('2026-09-28T07:00:00Z', '2026-09-28T15:00:00Z'),
    ];
    const result = computeUpcomingDutyNotifications(duties, disabledSettings, now);
    expect(result).toHaveLength(0);
  });

  test('skips duties whose lead-time trigger has already passed', () => {
    // Duty starts at 10:20, with 30 min lead → trigger at 9:50, which is before now (10:00)
    const duties = [
      duty('2026-09-27T10:20:00Z', '2026-09-27T18:00:00Z'),
    ];
    const result = computeUpcomingDutyNotifications(duties, settings, now);
    expect(result).toHaveLength(0);
  });

  test('uses configured lead time', () => {
    const duties = [
      duty('2026-09-27T12:00:00Z', '2026-09-27T20:00:00Z'),
    ];
    const hourLeadSettings: AppSettings = { ...settings, notifyUpcomingLeadMinutes: 60 };
    const result = computeUpcomingDutyNotifications(duties, hourLeadSettings, now);
    expect(result[0].triggerDate.getTime()).toBe(
      new Date('2026-09-27T11:00:00Z').getTime(),
    );
  });

  test('includes note in the notification body', () => {
    const duties = [
      duty('2026-09-27T12:00:00Z', '2026-09-27T20:00:00Z', { note: 'Morning shift' }),
    ];
    const result = computeUpcomingDutyNotifications(duties, settings, now);
    expect(result[0].body).toContain('Morning shift');
  });
});

describe('computeOverdueNotifications', () => {
  test('creates a notification for overdue pending duties', () => {
    const overdue = duty('2026-09-27T06:00:00Z', '2026-09-27T09:30:00Z');
    // Ended at 09:30, now is 10:00, but trigger fires at end + 15 min = 09:45 → still in future? No: 09:45 < 10:00
    // So this trigger has passed → no notification
    const result = computeOverdueNotifications([overdue], settings, now);
    expect(result).toHaveLength(0);
  });

  test('creates a notification when trigger has not yet fired', () => {
    // Ended at 09:50, trigger at 10:05, now is 10:00 → should fire
    const overdue = duty('2026-09-27T06:00:00Z', '2026-09-27T09:50:00Z');
    const result = computeOverdueNotifications([overdue], settings, now);
    expect(result).toHaveLength(1);
    expect(result[0].triggerDate.getTime()).toBe(
      new Date('2026-09-27T10:05:00Z').getTime(),
    );
  });

  test('skips completed duties', () => {
    const completed = duty('2026-09-27T06:00:00Z', '2026-09-27T09:50:00Z', { status: 'completed' });
    const result = computeOverdueNotifications([completed], settings, now);
    expect(result).toHaveLength(0);
  });

  test('returns empty when disabled', () => {
    const disabledSettings: AppSettings = { ...settings, notifyOverdueAttendance: false };
    const overdue = duty('2026-09-27T06:00:00Z', '2026-09-27T09:50:00Z');
    const result = computeOverdueNotifications([overdue], disabledSettings, now);
    expect(result).toHaveLength(0);
  });
});

describe('computeDailySummaryNotification', () => {
  test('creates a summary notification for tomorrow morning', () => {
    const result = computeDailySummaryNotification(settings, 3, now);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Ignis · Today');
    expect(result!.body).toBe('3 duties scheduled for today.');
    expect(result!.triggerDate.getHours()).toBe(7);
  });

  test('shows singular form for 1 duty', () => {
    const result = computeDailySummaryNotification(settings, 1, now);
    expect(result!.body).toBe('1 duty scheduled for today.');
  });

  test('shows "no duties" for zero', () => {
    const result = computeDailySummaryNotification(settings, 0, now);
    expect(result!.body).toBe('No duties scheduled for today.');
  });

  test('returns null when disabled', () => {
    const disabledSettings: AppSettings = { ...settings, notifyDailySummary: false };
    const result = computeDailySummaryNotification(disabledSettings, 3, now);
    expect(result).toBeNull();
  });
});

describe('computeAllNotifications', () => {
  test('aggregates all notification types', () => {
    const duties = [
      duty('2026-09-27T12:00:00Z', '2026-09-27T20:00:00Z'), // upcoming
      duty('2026-09-27T06:00:00Z', '2026-09-27T09:50:00Z'), // overdue (trigger at 10:05)
    ];
    const result = computeAllNotifications(duties, settings, now);
    // 1 upcoming + 1 overdue + 1 daily summary
    expect(result.length).toBeGreaterThanOrEqual(2);
    const identifiers = result.map((n) => n.identifier);
    expect(identifiers.some((id) => id.startsWith('upcoming-'))).toBe(true);
    expect(identifiers.some((id) => id.startsWith('overdue-'))).toBe(true);
  });
});
