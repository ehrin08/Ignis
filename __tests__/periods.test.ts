import { getPayPeriod } from '@/src/domain/periods';

import { settings } from '@/test-utils/fixtures';

describe('pay period boundaries', () => {
  test('weekly periods follow the configured anchor', () => {
    const period = getPayPeriod(new Date(2026, 7, 27), settings);
    expect(period.start).toEqual(new Date(2026, 7, 24));
    expect(period.end).toEqual(new Date(2026, 7, 31));
  });

  test('biweekly periods can navigate backward', () => {
    const period = getPayPeriod(new Date(2026, 8, 4), { ...settings, payCycleType: 'biweekly' }, -1);
    expect(period.start).toEqual(new Date(2026, 7, 10));
    expect(period.end).toEqual(new Date(2026, 7, 24));
  });

  test('semi-monthly periods split on the sixteenth', () => {
    const first = getPayPeriod(new Date(2026, 7, 8), { ...settings, payCycleType: 'semimonthly' });
    const second = getPayPeriod(new Date(2026, 7, 22), { ...settings, payCycleType: 'semimonthly' });
    expect(first).toEqual({ start: new Date(2026, 7, 1), end: new Date(2026, 7, 16) });
    expect(second).toEqual({ start: new Date(2026, 7, 16), end: new Date(2026, 8, 1) });
  });

  test('monthly periods clamp a day-31 anchor safely', () => {
    const period = getPayPeriod(new Date(2026, 8, 15), { ...settings, payCycleType: 'monthly', payCycleAnchor: '2026-08-31' });
    expect(period.start).toEqual(new Date(2026, 7, 31));
    expect(period.end).toEqual(new Date(2026, 8, 30));
  });

  test('weekly local boundaries remain calendar aligned across DST', () => {
    const period = getPayPeriod(new Date(2026, 2, 10), { ...settings, payCycleAnchor: '2026-03-02' });
    expect(period.start.getDay()).toBe(1);
    expect(period.end.getDay()).toBe(1);
    expect(period.end.getDate() - period.start.getDate()).toBe(7);
  });
});
