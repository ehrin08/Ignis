import { SQLiteDatabase } from 'expo-sqlite';

import { localDateKey } from '@/src/domain/format';
import { runWriteTransaction } from '@/src/data/transactions';

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA busy_timeout = 5000;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await runWriteTransaction(db, async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          onboarding_completed INTEGER NOT NULL DEFAULT 0,
          currency_code TEXT NOT NULL,
          hourly_rate_minor INTEGER NOT NULL DEFAULT 0 CHECK (hourly_rate_minor >= 0),
          pay_cycle_type TEXT NOT NULL DEFAULT 'biweekly' CHECK (pay_cycle_type IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
          pay_cycle_anchor TEXT NOT NULL,
          overtime_mode TEXT NOT NULL DEFAULT 'daily' CHECK (overtime_mode IN ('none', 'daily', 'weekly')),
          overtime_threshold_minutes INTEGER NOT NULL DEFAULT 480 CHECK (overtime_threshold_minutes > 0),
          overtime_multiplier_bps INTEGER NOT NULL DEFAULT 15000 CHECK (overtime_multiplier_bps >= 10000),
          workday_mask TEXT NOT NULL DEFAULT '1,2,3,4,5',
          scheduled_minutes_per_day INTEGER NOT NULL DEFAULT 480 CHECK (scheduled_minutes_per_day > 0),
          week_starts_on INTEGER NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shifts (
          id TEXT PRIMARY KEY NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          timezone TEXT NOT NULL,
          break_seconds INTEGER NOT NULL DEFAULT 0 CHECK (break_seconds >= 0),
          active_break_started_at INTEGER,
          note TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          CHECK (ended_at IS NULL OR ended_at > started_at),
          CHECK (active_break_started_at IS NULL OR ended_at IS NULL)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS one_active_shift
          ON shifts ((ended_at IS NULL))
          WHERE ended_at IS NULL;
        CREATE INDEX IF NOT EXISTS shifts_started_at ON shifts (started_at DESC);
      `);
      await transaction.execAsync('PRAGMA user_version = 1;');
    });
  }

  if (version < 2) {
    await runWriteTransaction(db, async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS schedule_series (
          id TEXT PRIMARY KEY NOT NULL,
          recurrence TEXT NOT NULL CHECK (recurrence IN ('once', 'daily', 'weekly')),
          start_date TEXT NOT NULL,
          end_date TEXT,
          weekday_mask TEXT NOT NULL DEFAULT '',
          start_minutes INTEGER NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
          end_minutes INTEGER NOT NULL CHECK (end_minutes BETWEEN 0 AND 1439),
          timezone TEXT NOT NULL,
          break_seconds INTEGER NOT NULL DEFAULT 0 CHECK (break_seconds >= 0),
          note TEXT NOT NULL DEFAULT '',
          generated_through TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scheduled_duties (
          id TEXT PRIMARY KEY NOT NULL,
          series_id TEXT REFERENCES schedule_series(id) ON DELETE SET NULL,
          occurrence_date TEXT NOT NULL,
          scheduled_start INTEGER NOT NULL,
          scheduled_end INTEGER,
          timezone TEXT NOT NULL,
          break_seconds INTEGER NOT NULL DEFAULT 0 CHECK (break_seconds >= 0),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'awol')),
          needs_review INTEGER NOT NULL DEFAULT 0,
          note TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          CHECK (scheduled_end IS NULL OR scheduled_end > scheduled_start)
        );

        CREATE TABLE IF NOT EXISTS schedule_exceptions (
          series_id TEXT NOT NULL REFERENCES schedule_series(id) ON DELETE CASCADE,
          occurrence_date TEXT NOT NULL,
          PRIMARY KEY (series_id, occurrence_date)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS duties_series_occurrence
          ON scheduled_duties (series_id, occurrence_date)
          WHERE series_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS duties_scheduled_start ON scheduled_duties (scheduled_start);
        CREATE INDEX IF NOT EXISTS duties_status ON scheduled_duties (status, scheduled_start);
        DROP INDEX IF EXISTS one_active_shift;
      `);

      const legacy = await transaction.getAllAsync<{
        id: string;
        started_at: number;
        ended_at: number | null;
        timezone: string;
        break_seconds: number;
        note: string;
        created_at: number;
        updated_at: number;
      }>('SELECT id, started_at, ended_at, timezone, break_seconds, note, created_at, updated_at FROM shifts');
      for (const shift of legacy) {
        await transaction.runAsync(
          `INSERT OR IGNORE INTO scheduled_duties (
            id, series_id, occurrence_date, scheduled_start, scheduled_end, timezone,
            break_seconds, status, needs_review, note, created_at, updated_at
          ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          `legacy-${shift.id}`,
          localDateKey(new Date(shift.started_at)),
          shift.started_at,
          shift.ended_at,
          shift.timezone,
          shift.break_seconds,
          shift.ended_at === null ? 'pending' : 'completed',
          shift.ended_at === null ? 1 : 0,
          shift.note,
          shift.created_at,
          shift.updated_at,
        );
      }
      await transaction.execAsync('PRAGMA user_version = 2;');
    });
  }

  if (version < 3) {
    await runWriteTransaction(db, async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE settings ADD COLUMN night_differential_bps INTEGER NOT NULL DEFAULT 1000 CHECK (night_differential_bps BETWEEN 0 AND 10000);
        ALTER TABLE settings ADD COLUMN night_differential_start_minutes INTEGER NOT NULL DEFAULT 1320 CHECK (night_differential_start_minutes BETWEEN 0 AND 1439);
        ALTER TABLE settings ADD COLUMN night_differential_end_minutes INTEGER NOT NULL DEFAULT 360 CHECK (night_differential_end_minutes BETWEEN 0 AND 1439);
        ALTER TABLE schedule_series ADD COLUMN hourly_rate_override_minor INTEGER CHECK (hourly_rate_override_minor >= 0);
        ALTER TABLE scheduled_duties ADD COLUMN hourly_rate_override_minor INTEGER CHECK (hourly_rate_override_minor >= 0);
        PRAGMA user_version = 3;
      `);
    });
  }

  if (version < 4) {
    await runWriteTransaction(db, async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_state (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_tombstones (
          entity_type TEXT NOT NULL CHECK (entity_type IN ('series', 'duty', 'exception')),
          entity_id TEXT NOT NULL,
          deleted_at INTEGER NOT NULL,
          device_id TEXT NOT NULL,
          PRIMARY KEY (entity_type, entity_id)
        );
        PRAGMA user_version = 4;
      `);
    });
  }

  if (version < 5) {
    await runWriteTransaction(db, async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE schedule_series ADD COLUMN rate_override_type TEXT CHECK (rate_override_type IN ('hourly', 'day'));
        ALTER TABLE schedule_series ADD COLUMN rate_override_minor INTEGER CHECK (rate_override_minor > 0);
        ALTER TABLE scheduled_duties ADD COLUMN rate_override_type TEXT CHECK (rate_override_type IN ('hourly', 'day'));
        ALTER TABLE scheduled_duties ADD COLUMN rate_override_minor INTEGER CHECK (rate_override_minor > 0);
        UPDATE schedule_series
          SET rate_override_type = 'hourly', rate_override_minor = hourly_rate_override_minor
          WHERE hourly_rate_override_minor > 0;
        UPDATE scheduled_duties
          SET rate_override_type = 'hourly', rate_override_minor = hourly_rate_override_minor
          WHERE hourly_rate_override_minor > 0;
        PRAGMA user_version = 5;
      `);
    });
  }

  if (version < 6) {
    await runWriteTransaction(db, async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE schedule_exceptions ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE schedule_exceptions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
        UPDATE schedule_exceptions
          SET created_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
              updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
          WHERE created_at = 0 OR updated_at = 0;
        PRAGMA user_version = 6;
      `);
    });
  }
}
