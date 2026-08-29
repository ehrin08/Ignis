import { AppSettings, ScheduledDuty, ScheduleSeries } from '@/src/types';

export const settings: AppSettings = {
  onboardingCompleted: true,
  currencyCode: 'USD',
  hourlyRateMinor: 2_000,
  payCycleType: 'weekly',
  payCycleAnchor: '2026-08-24',
  overtimeMode: 'none',
  overtimeThresholdMinutes: 480,
  overtimeMultiplierBps: 15_000,
  weekStartsOn: 1,
};

export function duty(start: string, end: string | null, overrides: Partial<ScheduledDuty> = {}): ScheduledDuty {
  const scheduledStart = new Date(start).getTime();
  const scheduledEnd = end ? new Date(end).getTime() : null;
  const startDate = new Date(scheduledStart);
  const occurrenceDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  return {
    id: `${scheduledStart}`,
    seriesId: null,
    occurrenceDate,
    scheduledStart,
    scheduledEnd,
    timezone: 'Asia/Manila',
    breakSeconds: 0,
    status: 'pending',
    needsReview: false,
    note: '',
    createdAt: scheduledStart,
    updatedAt: scheduledEnd ?? scheduledStart,
    ...overrides,
  };
}

export const weeklySeries: ScheduleSeries = {
  id: 'series-1',
  recurrence: 'weekly',
  startDate: '2026-08-24',
  endDate: null,
  weekdayMask: [1, 3, 5],
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
  timezone: 'Asia/Manila',
  breakSeconds: 0,
  note: '',
  generatedThrough: null,
  createdAt: 1,
  updatedAt: 1,
};
