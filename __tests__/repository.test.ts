import { migrateDatabase } from '@/src/data/migrations';
import { deleteSchedule, listDuties, saveSchedule, saveSettings, updateAttendance } from '@/src/data/repository';

import { settings } from '@/test-utils/fixtures';

describe('schedule repository contract', () => {
  test('latest migration creates schedule tables, premium settings, and preserves legacy shifts', async () => {
    const statements: string[] = [];
    const runs: unknown[][] = [];
    type DbDouble = {
      execAsync: (sql: string) => Promise<void>;
      getFirstAsync: (sql: string) => Promise<unknown>;
      getAllAsync: (sql: string) => Promise<unknown[]>;
      runAsync: (...args: unknown[]) => Promise<void>;
      withTransactionAsync: (callback: () => Promise<void>) => Promise<void>;
      withExclusiveTransactionAsync: (callback: (transaction: DbDouble) => Promise<void>) => Promise<void>;
    };
    let db: DbDouble;
    db = {
      execAsync: jest.fn(async (sql: string) => { statements.push(sql); }),
      getFirstAsync: jest.fn(async () => ({ user_version: 0 })),
      getAllAsync: jest.fn(async () => [{
        id: 'old-1', started_at: 100, ended_at: 200, timezone: 'UTC', break_seconds: 20,
        note: 'Legacy', created_at: 90, updated_at: 210,
      }]),
      runAsync: jest.fn(async (...args: unknown[]) => { runs.push(args); }),
      withTransactionAsync: jest.fn(async (callback) => callback()),
      withExclusiveTransactionAsync: jest.fn(async (callback) => callback(db)),
    };
    await migrateDatabase(db as never);
    const sql = statements.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS schedule_series');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS scheduled_duties');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS schedule_exceptions');
    expect(sql).toContain('PRAGMA user_version = 3');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sync_tombstones');
    expect(sql).toContain('PRAGMA user_version = 4');
    expect(sql).toContain('PRAGMA user_version = 5');
    expect(sql).toContain('PRAGMA user_version = 6');
    expect(sql).toContain('schedule_exceptions ADD COLUMN updated_at');
    expect(sql).toContain('night_differential_bps');
    expect(sql).toContain('hourly_rate_override_minor');
    expect(sql).toContain('rate_override_type');
    expect(sql).toContain("SET rate_override_type = 'hourly'");
    expect(runs.some((call) => call.includes('legacy-old-1'))).toBe(true);
    expect(runs.some((call) => call.includes('completed'))).toBe(true);
  });

  test('maps duty rows into the domain shape', async () => {
    const db = {
      getAllAsync: jest.fn(async () => [{
        id: 'duty-1', series_id: 'series-1', occurrence_date: '2026-08-24', scheduled_start: 100,
        scheduled_end: 200, timezone: 'UTC', break_seconds: 20, rate_override_type: 'day', rate_override_minor: 2500, status: 'completed', needs_review: 0,
        note: 'Training', created_at: 90, updated_at: 210,
      }]),
    };
    await expect(listDuties(db as never)).resolves.toEqual([{
      id: 'duty-1', seriesId: 'series-1', occurrenceDate: '2026-08-24', scheduledStart: 100,
      scheduledEnd: 200, timezone: 'UTC', breakSeconds: 20, rateOverride: { type: 'day', amountMinor: 2500 }, status: 'completed', needsReview: false,
      note: 'Training', createdAt: 90, updatedAt: 210,
    }]);
  });

  test('upgrades v4 rate overrides as hourly values', async () => {
    const statements: string[] = [];
    type DbDouble = {
      execAsync: (sql: string) => Promise<void>;
      getFirstAsync: () => Promise<{ user_version: number }>;
      withTransactionAsync: (callback: () => Promise<void>) => Promise<void>;
      withExclusiveTransactionAsync: (callback: (transaction: DbDouble) => Promise<void>) => Promise<void>;
    };
    let db: DbDouble;
    db = {
      execAsync: jest.fn(async (sql: string) => { statements.push(sql); }),
      getFirstAsync: jest.fn(async () => ({ user_version: 4 })),
      withTransactionAsync: jest.fn(async (callback) => callback()),
      withExclusiveTransactionAsync: jest.fn(async (callback) => callback(db)),
    };

    await migrateDatabase(db as never);

    const sql = statements.join('\n');
    expect(sql).toContain('ADD COLUMN rate_override_type');
    expect(sql).toContain("SET rate_override_type = 'hourly'");
    expect(sql).toContain('WHERE hourly_rate_override_minor > 0');
    expect(sql).toContain('PRAGMA user_version = 5');
  });

  test('does not allow attendance before a duty ends', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({
        id: 'duty-1', series_id: null, occurrence_date: '2026-08-24', scheduled_start: 100,
        scheduled_end: 500, timezone: 'UTC', break_seconds: 0, status: 'pending', needs_review: 0,
        note: '', created_at: 90, updated_at: 90,
      })),
      runAsync: jest.fn(),
    };
    await expect(updateAttendance(db as never, 'duty-1', 'completed', 400)).rejects.toThrow(/after the duty ends/i);
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  test('persists the complete pay profile without planned-week fields', async () => {
    const profile = {
      ...settings,
      payCycleType: 'semimonthly' as const,
      overtimeMode: 'daily' as const,
      overtimeThresholdMinutes: 8 * 60,
      overtimeMultiplierBps: 13_000,
      nightDifferentialBps: 1_000,
      nightDifferentialStartMinutes: 22 * 60,
      nightDifferentialEndMinutes: 6 * 60,
    };
    const runAsync = jest.fn<Promise<undefined>, [string, ...unknown[]]>(async (sql, ...parameters) => {
      expect(sql.match(/\?/g) ?? []).toHaveLength(parameters.length);
    });
    await saveSettings({ runAsync } as never, profile);
    expect(runAsync).toHaveBeenCalledTimes(1);
    expect(runAsync.mock.calls[0][0]).toContain('ON CONFLICT(id) DO UPDATE');
    expect(runAsync.mock.calls[0].slice(1)).toEqual([
      1,
      profile.currencyCode,
      profile.hourlyRateMinor,
      profile.payCycleType,
      profile.payCycleAnchor,
      profile.overtimeMode,
      profile.overtimeThresholdMinutes,
      profile.overtimeMultiplierBps,
      profile.nightDifferentialBps,
      profile.nightDifferentialStartMinutes,
      profile.nightDifferentialEndMinutes,
      profile.weekStartsOn,
      expect.any(Number),
    ]);
    expect(runAsync.mock.calls[0][0]).not.toContain('workday_mask');
  });

  test('reserves later decided attendance when editing this and future duties', async () => {
    const calls: unknown[][] = [];
    const dutyRow = {
      id: 'duty-1', series_id: 'series-old', occurrence_date: '2026-08-24', scheduled_start: 100,
      scheduled_end: 200, timezone: 'UTC', break_seconds: 0, status: 'pending', needs_review: 0,
      note: '', created_at: 90, updated_at: 90,
    };
    const seriesRow = {
      id: 'series-old', recurrence: 'weekly', start_date: '2026-08-01', end_date: null,
      weekday_mask: '1,3,5', start_minutes: 540, end_minutes: 1020, timezone: 'UTC',
      break_seconds: 0, note: '', generated_through: '2026-11-01', created_at: 1, updated_at: 1,
    };
    type DbDouble = {
      getFirstAsync: (sql: string) => Promise<unknown>;
      getAllAsync: (sql: string) => Promise<unknown[]>;
      runAsync: (...args: unknown[]) => Promise<void>;
      withTransactionAsync: (callback: () => Promise<void>) => Promise<void>;
      withExclusiveTransactionAsync: (callback: (transaction: DbDouble) => Promise<void>) => Promise<void>;
    };
    let db: DbDouble;
    db = {
      getFirstAsync: jest.fn(async (sql: string) => sql.includes('FROM scheduled_duties WHERE id') ? dutyRow : sql.includes('FROM schedule_series') ? seriesRow : null),
      getAllAsync: jest.fn(async (sql: string) => sql.includes("status != 'pending'") ? [{ occurrence_date: '2026-08-26' }] : [{ occurrence_date: '2026-08-26' }]),
      runAsync: jest.fn(async (...args: unknown[]) => { calls.push(args); }),
      withTransactionAsync: jest.fn(async (callback) => callback()),
      withExclusiveTransactionAsync: jest.fn(async (callback) => callback(db)),
    };

    await saveSchedule(db as never, {
      dutyId: 'duty-1', seriesId: 'series-old', scope: 'future', recurrence: 'once',
      startDate: '2026-08-24', endDate: null, weekdayMask: [], startMinutes: 600, endMinutes: 1080,
      timezone: 'UTC', breakSeconds: 0, rateOverride: { type: 'day', amountMinor: 25_000 }, note: 'Changed',
    });

    expect(calls.some((call) => String(call[0]).includes('schedule_exceptions') && call.includes('2026-08-26'))).toBe(true);
    expect(calls.some((call) => call.includes('day') && call.includes(25_000))).toBe(true);
  });

  test('records tombstones for every pending duty removed from a future schedule', async () => {
    const calls: unknown[][] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM scheduled_duties WHERE id')) return {
          id: 'duty-1', series_id: 'series-1', occurrence_date: '2026-08-24', scheduled_start: 100,
          scheduled_end: 200, timezone: 'UTC', break_seconds: 0, rate_override_type: null,
          rate_override_minor: null, status: 'pending', needs_review: 0, note: '', created_at: 90, updated_at: 90,
        };
        if (sql.includes('sync_state')) return { value: 'device-a' };
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string) => sql.includes('SELECT id FROM scheduled_duties')
        ? [{ id: 'duty-1' }, { id: 'duty-2' }]
        : []),
      runAsync: jest.fn(async (...args: unknown[]) => { calls.push(args); }),
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    };

    await deleteSchedule(db as never, 'duty-1', 'future');

    const tombstones = calls.filter((call) => String(call[0]).includes('sync_tombstones'));
    expect(tombstones).toHaveLength(2);
    expect(tombstones.map((call) => call[2])).toEqual(['duty-1', 'duty-2']);
  });

  test('rejects a new duty when its occurrence date is already taken', async () => {
    const runs: unknown[][] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string, ...parameters: unknown[]) => {
        if (sql.includes('WHERE id = ?')) return null;
        if (sql.includes('occurrence_date = ?') && parameters.includes('2030-04-15')) return { id: 'existing-duty' };
        return null;
      }),
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async (...args: unknown[]) => { runs.push(args); }),
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    };

    await expect(saveSchedule(db as never, {
      scope: 'occurrence', recurrence: 'once', startDate: '2030-04-15', endDate: null,
      weekdayMask: [], startMinutes: 540, endMinutes: 1020, timezone: 'UTC', breakSeconds: 0,
      rateOverride: null, note: '',
    })).rejects.toThrow(/already scheduled for this date/i);
    expect(runs.some((call) => String(call[0]).includes('INSERT OR IGNORE INTO scheduled_duties'))).toBe(false);
  });

  test('allows a non-placement edit to a grandfathered duplicate duty', async () => {
    const start = Date.parse('2026-08-24T09:00:00.000Z');
    const end = Date.parse('2026-08-24T17:00:00.000Z');
    const dutyRow = {
      id: 'duty-1', series_id: null, occurrence_date: '2026-08-24', scheduled_start: start,
      scheduled_end: end, timezone: 'UTC', break_seconds: 0, rate_override_type: null,
      rate_override_minor: null, status: 'pending', needs_review: 0, note: '', created_at: 90, updated_at: 90,
    };
    const calls: unknown[][] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => sql.includes('FROM scheduled_duties WHERE id') ? dutyRow : null),
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async (...args: unknown[]) => { calls.push(args); }),
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    };

    await expect(saveSchedule(db as never, {
      dutyId: 'duty-1', scope: 'occurrence', recurrence: 'once', startDate: '2026-08-24', endDate: null,
      weekdayMask: [], startMinutes: 540, endMinutes: 1020, timezone: 'UTC', breakSeconds: 0,
      rateOverride: null, note: 'Updated note',
    })).resolves.toBeUndefined();
    expect(calls.some((call) => String(call[0]).includes('UPDATE scheduled_duties') && call.includes('Updated note'))).toBe(true);
  });
});
