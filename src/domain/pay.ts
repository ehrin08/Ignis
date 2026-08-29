import { localDateKey } from '@/src/domain/format';
import { isInPeriod, startOfWeek } from '@/src/domain/periods';
import { addCalendarDays, parseLocalDate, scheduledRange, wallClockDate } from '@/src/domain/schedule';
import { AppSettings, DashboardSummary, PayBreakdown, PayPeriod, ScheduledDuty } from '@/src/types';

export function getDutyPaidSeconds(duty: ScheduledDuty) {
  if (duty.scheduledEnd === null) return 0;
  return Math.max(0, Math.floor((duty.scheduledEnd - duty.scheduledStart) / 1000 - duty.breakSeconds));
}

function emptyBreakdown(): PayBreakdown {
  return { paidSeconds: 0, regularSeconds: 0, overtimeSeconds: 0, grossMinor: 0 };
}

function bucketFor(duty: ScheduledDuty, settings: AppSettings) {
  if (settings.overtimeMode === 'daily') return localDateKey(new Date(duty.scheduledStart));
  if (settings.overtimeMode === 'weekly') return localDateKey(startOfWeek(new Date(duty.scheduledStart), settings.weekStartsOn));
  return 'all';
}

function getNightSeconds(duty: ScheduledDuty, settings: AppSettings) {
  if (duty.scheduledEnd === null || settings.nightDifferentialBps === 0) return 0;
  const payableEnd = duty.scheduledEnd - duty.breakSeconds * 1000;
  if (payableEnd <= duty.scheduledStart) return 0;
  const first = localDateKey(wallClockDate(duty.scheduledStart, duty.timezone));
  const last = localDateKey(wallClockDate(payableEnd - 1, duty.timezone));
  let cursor = addCalendarDays(parseLocalDate(first), -1);
  const end = parseLocalDate(last);
  let total = 0;
  while (cursor <= end) {
    const range = scheduledRange(localDateKey(cursor), settings.nightDifferentialStartMinutes, settings.nightDifferentialEndMinutes, duty.timezone);
    total += Math.max(0, Math.min(payableEnd, range.end) - Math.max(duty.scheduledStart, range.start));
    cursor = addCalendarDays(cursor, 1);
  }
  return Math.floor(total / 1000);
}

export function calculatePay(duties: ScheduledDuty[], settings: AppSettings): PayBreakdown {
  const ordered = duties.filter((duty) => duty.scheduledEnd !== null).slice().sort((a, b) => a.scheduledStart - b.scheduledStart);
  if (!ordered.length) return emptyBreakdown();
  const bucketTotals = new Map<string, number>();
  const threshold = settings.overtimeThresholdMinutes * 60;
  let paidSeconds = 0;
  let regularSeconds = 0;
  let overtimeSeconds = 0;
  let gross = 0;

  for (const duty of ordered) {
    const seconds = getDutyPaidSeconds(duty);
    const key = bucketFor(duty, settings);
    const consumed = bucketTotals.get(key) ?? 0;
    const regular = settings.overtimeMode === 'none' ? seconds : Math.max(0, Math.min(seconds, threshold - consumed));
    const overtime = seconds - regular;
    bucketTotals.set(key, consumed + seconds);
    const rate = duty.hourlyRateOverrideMinor ?? settings.hourlyRateMinor;
    const nightSeconds = getNightSeconds(duty, settings);
    const overtimePremium = overtime * ((settings.overtimeMultiplierBps - 10_000) / 10_000);
    const nightPremium = nightSeconds * (settings.nightDifferentialBps / 10_000);
    gross += ((regular + overtime + overtimePremium + nightPremium) / 3600) * rate;
    paidSeconds += seconds;
    regularSeconds += regular;
    overtimeSeconds += overtime;
  }

  return { paidSeconds, regularSeconds, overtimeSeconds, grossMinor: Math.round(gross) };
}

export function allocateDutyGross(duties: ScheduledDuty[], settings: AppSettings) {
  const ordered = duties.slice().sort((a, b) => a.scheduledStart - b.scheduledStart);
  const allocation = new Map<string, number>();
  const included: ScheduledDuty[] = [];
  let previousGross = 0;
  for (const duty of ordered) {
    included.push(duty);
    const gross = calculatePay(included, settings).grossMinor;
    allocation.set(duty.id, gross - previousGross);
    previousGross = gross;
  }
  return allocation;
}

export function calculateDashboardSummary(duties: ScheduledDuty[], settings: AppSettings, period: PayPeriod, now = new Date()): DashboardSummary {
  const inPeriod = duties.filter((duty) => isInPeriod(duty.scheduledStart, period));
  const completed = inPeriod.filter((duty) => duty.status === 'completed' && duty.scheduledEnd !== null);
  const projectable = inPeriod.filter((duty) => duty.status === 'pending' && duty.scheduledEnd !== null && duty.scheduledEnd > now.getTime());
  const overdueCount = inPeriod.filter((duty) => duty.status === 'pending' && (duty.scheduledEnd === null || duty.scheduledEnd <= now.getTime())).length;
  const earned = calculatePay(completed, settings);
  const projected = calculatePay([...completed, ...projectable], settings);
  return { earned, projected: projected.grossMinor < earned.grossMinor ? earned : projected, overdueCount };
}
