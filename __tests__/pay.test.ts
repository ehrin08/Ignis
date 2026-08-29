import { allocateDutyGross, calculateDashboardSummary, calculatePay, getDutyPaidSeconds } from '@/src/domain/pay';
import { getPayPeriod } from '@/src/domain/periods';

import { duty, settings } from '@/test-utils/fixtures';

describe('scheduled duty pay calculation', () => {
  test('subtracts unpaid breaks and rounds gross pay', () => {
    const entry = duty('2026-08-24T09:00:00+08:00', '2026-08-24T17:30:00+08:00', { breakSeconds: 1800, status: 'completed' });
    expect(getDutyPaidSeconds(entry)).toBe(8 * 3600);
    expect(calculatePay([entry], settings).grossMinor).toBe(16_000);
  });

  test('daily overtime aggregates multiple completed duties', () => {
    const entries = [
      duty('2026-08-24T06:00:00+08:00', '2026-08-24T12:00:00+08:00', { status: 'completed' }),
      duty('2026-08-24T13:00:00+08:00', '2026-08-24T17:00:00+08:00', { status: 'completed' }),
    ];
    const result = calculatePay(entries, { ...settings, overtimeMode: 'daily' });
    expect(result.regularSeconds).toBe(8 * 3600);
    expect(result.overtimeSeconds).toBe(2 * 3600);
    expect(result.grossMinor).toBe(22_000);
    const allocated = allocateDutyGross(entries, { ...settings, overtimeMode: 'daily' });
    expect([...allocated.values()].reduce((sum, value) => sum + value, 0)).toBe(result.grossMinor);
  });

  test('weekly overtime crosses the configured threshold', () => {
    const entries = Array.from({ length: 5 }, (_, day) =>
      duty(`2026-08-${24 + day}T08:00:00+08:00`, `2026-08-${24 + day}T17:00:00+08:00`, { status: 'completed' }),
    );
    const result = calculatePay(entries, { ...settings, overtimeMode: 'weekly', overtimeThresholdMinutes: 40 * 60 });
    expect(result.regularSeconds).toBe(40 * 3600);
    expect(result.overtimeSeconds).toBe(5 * 3600);
    expect(result.grossMinor).toBe(95_000);
  });

  test('adds night differential to payable night time after an unpaid break', () => {
    const entry = duty('2026-08-24T21:00:00+08:00', '2026-08-25T06:00:00+08:00', { breakSeconds: 30 * 60, status: 'completed' });
    const result = calculatePay([entry], { ...settings, overtimeMode: 'none' });
    expect(result.paidSeconds).toBe(8.5 * 3600);
    expect(result.grossMinor).toBe(18_500);
  });

  test('adds overtime and night premiums when their time overlaps', () => {
    const entry = duty('2026-08-24T22:00:00+08:00', '2026-08-25T06:00:00+08:00', { status: 'completed' });
    const result = calculatePay([entry], { ...settings, overtimeMode: 'daily', overtimeThresholdMinutes: 4 * 60 });
    expect(result.regularSeconds).toBe(4 * 3600);
    expect(result.overtimeSeconds).toBe(4 * 3600);
    expect(result.grossMinor).toBe(21_600);
  });

  test('uses a duty hourly-rate override without changing the default rate', () => {
    const entry = duty('2026-08-24T09:00:00+08:00', '2026-08-24T17:00:00+08:00', { hourlyRateOverrideMinor: 3_000, status: 'completed' });
    expect(calculatePay([entry], { ...settings, nightDifferentialBps: 0 }).grossMinor).toBe(24_000);
    expect(settings.hourlyRateMinor).toBe(2_000);
  });

  test('completed earns, future pending projects, AWOL and overdue pending pay zero', () => {
    const now = new Date('2026-08-26T12:00:00+08:00');
    const period = getPayPeriod(now, settings);
    const entries = [
      duty('2026-08-24T09:00:00+08:00', '2026-08-24T17:00:00+08:00', { status: 'completed' }),
      duty('2026-08-25T09:00:00+08:00', '2026-08-25T17:00:00+08:00', { status: 'awol' }),
      duty('2026-08-26T06:00:00+08:00', '2026-08-26T10:00:00+08:00', { status: 'pending' }),
      duty('2026-08-27T09:00:00+08:00', '2026-08-27T17:00:00+08:00', { status: 'pending' }),
    ];
    const summary = calculateDashboardSummary(entries, settings, period, now);
    expect(summary.earned.grossMinor).toBe(16_000);
    expect(summary.projected.grossMinor).toBe(32_000);
    expect(summary.overdueCount).toBe(1);
  });

  test('a migrated duty missing its end stays out of estimates and needs review', () => {
    const now = new Date('2026-08-26T12:00:00+08:00');
    const period = getPayPeriod(now, settings);
    const summary = calculateDashboardSummary([
      duty('2026-08-25T09:00:00+08:00', null, { needsReview: true }),
    ], settings, period, now);
    expect(summary.earned.grossMinor).toBe(0);
    expect(summary.projected.grossMinor).toBe(0);
    expect(summary.overdueCount).toBe(1);
  });
});
