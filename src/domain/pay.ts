import { localDateKey } from '@/src/domain/format';
import { isInPeriod, startOfWeek } from '@/src/domain/periods';
import { AppSettings, DashboardSummary, PayBreakdown, PayPeriod, ScheduledDuty } from '@/src/types';

export function getDutyPaidSeconds(duty: ScheduledDuty) {
  if (duty.scheduledEnd === null) return 0;
  return Math.max(0, Math.floor((duty.scheduledEnd - duty.scheduledStart) / 1000 - duty.breakSeconds));
}

function emptyBreakdown(): PayBreakdown {
  return { paidSeconds: 0, regularSeconds: 0, overtimeSeconds: 0, grossMinor: 0 };
}

export function calculatePay(duties: ScheduledDuty[], settings: AppSettings): PayBreakdown {
  const payable = duties.filter((duty) => duty.scheduledEnd !== null);
  if (!payable.length || settings.hourlyRateMinor <= 0) return emptyBreakdown();
  const buckets = new Map<string, number>();
  let total = 0;

  for (const duty of payable) {
    const seconds = getDutyPaidSeconds(duty);
    total += seconds;
    let key = 'all';
    if (settings.overtimeMode === 'daily') key = localDateKey(new Date(duty.scheduledStart));
    if (settings.overtimeMode === 'weekly') key = localDateKey(startOfWeek(new Date(duty.scheduledStart), settings.weekStartsOn));
    buckets.set(key, (buckets.get(key) ?? 0) + seconds);
  }

  if (settings.overtimeMode === 'none') {
    return { paidSeconds: total, regularSeconds: total, overtimeSeconds: 0, grossMinor: Math.round((total / 3600) * settings.hourlyRateMinor) };
  }

  const threshold = settings.overtimeThresholdMinutes * 60;
  let regularSeconds = 0;
  let overtimeSeconds = 0;
  for (const seconds of buckets.values()) {
    regularSeconds += Math.min(seconds, threshold);
    overtimeSeconds += Math.max(0, seconds - threshold);
  }
  const regularPay = (regularSeconds / 3600) * settings.hourlyRateMinor;
  const overtimePay = (overtimeSeconds / 3600) * settings.hourlyRateMinor * (settings.overtimeMultiplierBps / 10_000);
  return {
    paidSeconds: total,
    regularSeconds,
    overtimeSeconds,
    grossMinor: Math.round(regularPay + overtimePay),
  };
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

export function calculateDashboardSummary(
  duties: ScheduledDuty[],
  settings: AppSettings,
  period: PayPeriod,
  now = new Date(),
): DashboardSummary {
  const inPeriod = duties.filter((duty) => isInPeriod(duty.scheduledStart, period));
  const completed = inPeriod.filter((duty) => duty.status === 'completed' && duty.scheduledEnd !== null);
  const projectable = inPeriod.filter((duty) =>
    duty.status === 'pending' && duty.scheduledEnd !== null && duty.scheduledEnd > now.getTime(),
  );
  const overdueCount = inPeriod.filter((duty) =>
    duty.status === 'pending' && (duty.scheduledEnd === null || duty.scheduledEnd <= now.getTime()),
  ).length;
  const earned = calculatePay(completed, settings);
  const projected = calculatePay([...completed, ...projectable], settings);
  return { earned, projected: projected.grossMinor < earned.grossMinor ? earned : projected, overdueCount };
}
