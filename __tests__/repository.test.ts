import { migrateDatabase } from '@/src/data/migrations';
import { listDuties, saveSchedule, saveSettings, updateAttendance } from '@/src/data/repository';

import { settings } from '@/test-utils/fixtures';

describe('schedule repository contract', () => {
  test('version 2 migration creates schedule tables and preserves legacy shifts', async () => {
    const statements: string[] = [];
    const runs: unknown[][] = [];
    type DbDouble = {
      execAsync: (sql: string) => Promise<void>;
      getFirstAsync: (sql: string) => Promise<unknown>;
      getAllAsync: (sql: string) => Promise<unknown[]>;
      runAsync: (...args: unknown[]) => Promise<void>;
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
      withExclusiveTransactionAsync: jest.fn(async (callback) => callback(db)),
    };
    await migrateDatabase(db as never);
    const sql = statements.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS schedule_series');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS scheduled_duties');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS schedule_exceptions');
    expect(sql).toContain('PRAGMA user_version = 2');
    expect(runs.some((call) => call.includes('legacy-old-1'))).toBe(true);
    expect(runs.some((call) => call.includes('completed'))).toBe(true);
  });

  test('maps duty rows into the domain shape', async () => {
    const db = {
      getAllAsync: jest.fn(async () => [{
        id: 'duty-1', series_id: 'series-1', occurrence_date: '2026-08-24', scheduled_start: 100,
        scheduled_end: 200, timezone: 'UTC', break_seconds: 20, status: 'completed', needs_review: 0,
        note: 'Training', created_at: 90, updated_at: 210,
      }]),
    };
    await expect(listDuties(db as never)).resolves.toEqual([{
      id: 'duty-1', seriesId: 'series-1', occurrenceDate: '2026-08-24', scheduledStart: 100,
      scheduledEnd: 200, timezone: 'UTC', breakSeconds: 20, status: 'completed', needsReview: false,
      note: 'Training', createdAt: 90, updatedAt: 210,
    }]);
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
    const runAsync = jest.fn<Promise<undefined>, [string, ...unknown[]]>(async () => undefined);
    await saveSettings({ runAsync } as never, settings);
    expect(runAsync).toHaveBeenCalledTimes(1);
    expect(runAsync.mock.calls[0][0]).toContain('ON CONFLICT(id) DO UPDATE');
    expect(runAsync.mock.calls[0]).toContain(settings.currencyCode);
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
      withExclusiveTransactionAsync: (callback: (transaction: DbDouble) => Promise<void>) => Promise<void>;
    };
    let db: DbDouble;
    db = {
      getFirstAsync: jest.fn(async (sql: string) => sql.includes('FROM scheduled_duties WHERE id') ? dutyRow : sql.includes('FROM schedule_series') ? seriesRow : null),
      getAllAsync: jest.fn(async (sql: string) => sql.includes("status != 'pending'") ? [{ occurrence_date: '2026-08-26' }] : [{ occurrence_date: '2026-08-26' }]),
      runAsync: jest.fn(async (...args: unknown[]) => { calls.push(args); }),
      withExclusiveTransactionAsync: jest.fn(async (callback) => callback(db)),
    };

    await saveSchedule(db as never, {
      dutyId: 'duty-1', seriesId: 'series-old', scope: 'future', recurrence: 'once',
      startDate: '2026-08-24', endDate: null, weekdayMask: [], startMinutes: 600, endMinutes: 1080,
      timezone: 'UTC', breakSeconds: 0, note: 'Changed',
    });

    expect(calls.some((call) => String(call[0]).includes('schedule_exceptions') && call.includes('2026-08-26'))).toBe(true);
  });
});
