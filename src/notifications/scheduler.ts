import type { AppSettings, ScheduledDuty } from '@/src/types';
import { findNextUpcomingDuty, findOverdueDuties, wallClockDate } from '@/src/domain/schedule';
import { CHANNEL_ATTENDANCE, CHANNEL_DUTY, CHANNEL_SUMMARY } from './channels';

export type NotificationDescriptor = {
  identifier: string;
  title: string;
  body: string;
  triggerDate: Date;
  channelId: string;
  data?: Record<string, unknown>;
};

/**
 * Compute upcoming-duty notifications for all pending duties in the future.
 * One notification per future pending duty, firing `leadMinutes` before its start.
 */
export function computeUpcomingDutyNotifications(
  duties: ScheduledDuty[],
  settings: AppSettings,
  now = new Date(),
): NotificationDescriptor[] {
  if (!settings.notifyUpcomingDuty) return [];

  const nowMs = now.getTime();
  const leadMs = settings.notifyUpcomingLeadMinutes * 60 * 1000;
  const results: NotificationDescriptor[] = [];

  for (const duty of duties) {
    if (duty.status !== 'pending') continue;
    if (duty.scheduledStart <= nowMs) continue;

    const triggerMs = duty.scheduledStart - leadMs;
    if (triggerMs <= nowMs) continue;

    const startWall = wallClockDate(duty.scheduledStart, duty.timezone);
    const timeStr = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(startWall);

    results.push({
      identifier: `upcoming-${duty.id}`,
      title: 'Upcoming duty',
      body: duty.note
        ? `${timeStr} — ${duty.note}`
        : `Your shift starts at ${timeStr}`,
      triggerDate: new Date(triggerMs),
      channelId: CHANNEL_DUTY,
      data: { dutyId: duty.id },
    });
  }

  return results;
}

/**
 * Compute overdue-attendance notifications for ended pending duties.
 * Fires 15 minutes after duty end to give the user a grace period.
 */
export function computeOverdueNotifications(
  duties: ScheduledDuty[],
  settings: AppSettings,
  now = new Date(),
): NotificationDescriptor[] {
  if (!settings.notifyOverdueAttendance) return [];

  const nowMs = now.getTime();
  const graceMs = 15 * 60 * 1000;
  const overdue = findOverdueDuties(duties, now);
  const results: NotificationDescriptor[] = [];

  for (const duty of overdue) {
    const triggerMs = duty.scheduledEnd! + graceMs;
    if (triggerMs <= nowMs) continue;

    results.push({
      identifier: `overdue-${duty.id}`,
      title: 'Attendance review',
      body: duty.note
        ? `Mark "${duty.note}" as completed or AWOL`
        : 'A duty has ended — mark it as completed or AWOL',
      triggerDate: new Date(triggerMs),
      channelId: CHANNEL_ATTENDANCE,
      data: { dutyId: duty.id },
    });
  }

  return results;
}

/**
 * Compute the daily summary notification trigger.
 * Fires tomorrow at the configured hour if there are duties today.
 */
export function computeDailySummaryNotification(
  settings: AppSettings,
  todayDutyCount: number,
  now = new Date(),
): NotificationDescriptor | null {
  if (!settings.notifyDailySummary) return null;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(settings.notifyDailySummaryHour, 0, 0, 0);

  if (tomorrow.getTime() <= now.getTime()) return null;

  const body =
    todayDutyCount === 0
      ? 'No duties scheduled for today.'
      : todayDutyCount === 1
        ? '1 duty scheduled for today.'
        : `${todayDutyCount} duties scheduled for today.`;

  return {
    identifier: 'daily-summary',
    title: 'Ignis · Today',
    body,
    triggerDate: tomorrow,
    channelId: CHANNEL_SUMMARY,
  };
}

/**
 * Aggregate all notification descriptors from current app state.
 */
export function computeAllNotifications(
  duties: ScheduledDuty[],
  settings: AppSettings,
  now = new Date(),
): NotificationDescriptor[] {
  const nowMs = now.getTime();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const todayDutyCount = duties.filter(
    (d) => d.scheduledStart >= todayStart.getTime() && d.scheduledStart < tomorrowStart.getTime(),
  ).length;

  const all: NotificationDescriptor[] = [
    ...computeUpcomingDutyNotifications(duties, settings, now),
    ...computeOverdueNotifications(duties, settings, now),
  ];

  const summary = computeDailySummaryNotification(settings, todayDutyCount, now);
  if (summary) all.push(summary);

  return all;
}
