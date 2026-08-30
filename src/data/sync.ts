import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { getOrCreateDeviceId, getSyncState, removeSyncState, setSyncState } from '@/src/data/sync-state';
import { supabase } from '@/src/data/supabase';
import { runSerializedWrite, runWriteTransaction } from '@/src/data/transactions';

type JsonValue = string | number | boolean | null;
type JsonRow = Record<string, JsonValue>;

export type SyncSnapshot = {
  deviceId: string;
  settings: JsonRow | null;
  series: JsonRow[];
  duties: JsonRow[];
  exceptions: JsonRow[];
  tombstones: JsonRow[];
};

const SETTINGS_COLUMNS = [
  'id', 'onboarding_completed', 'currency_code', 'hourly_rate_minor', 'pay_cycle_type',
  'pay_cycle_anchor', 'overtime_mode', 'overtime_threshold_minutes', 'overtime_multiplier_bps',
  'night_differential_bps', 'night_differential_start_minutes', 'night_differential_end_minutes',
  'week_starts_on', 'updated_at',
] as const;

const SERIES_COLUMNS = [
  'id', 'recurrence', 'start_date', 'end_date', 'weekday_mask', 'start_minutes', 'end_minutes',
  'timezone', 'break_seconds', 'rate_override_type', 'rate_override_minor', 'note', 'created_at', 'updated_at',
] as const;

const DUTY_COLUMNS = [
  'id', 'series_id', 'occurrence_date', 'scheduled_start', 'scheduled_end', 'timezone',
  'break_seconds', 'rate_override_type', 'rate_override_minor', 'status', 'needs_review', 'note',
  'created_at', 'updated_at',
] as const;

const EXCEPTION_COLUMNS = ['series_id', 'occurrence_date', 'created_at', 'updated_at'] as const;
const TOMBSTONE_COLUMNS = ['entity_type', 'entity_id', 'deleted_at', 'device_id'] as const;

export async function accountOwner(db: SQLiteDatabase) {
  return getSyncState(db, 'owner_id');
}

async function clearAccountRows(db: SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM schedule_exceptions;
    DELETE FROM scheduled_duties;
    DELETE FROM schedule_series;
    DELETE FROM settings;
    DELETE FROM sync_tombstones;
  `);
  await removeSyncState(db, 'owner_id', 'last_sync_at');
}

export async function clearAccountData(db: SQLiteDatabase) {
  await runWriteTransaction(db, clearAccountRows);
}

async function createSnapshot(db: SQLiteDatabase): Promise<SyncSnapshot> {
  const [settings, series, duties, exceptions, tombstones, deviceId] = await Promise.all([
    db.getFirstAsync<JsonRow>(`SELECT ${SETTINGS_COLUMNS.join(', ')} FROM settings WHERE id = 1`),
    db.getAllAsync<JsonRow>(`SELECT ${SERIES_COLUMNS.join(', ')} FROM schedule_series`),
    db.getAllAsync<JsonRow>(`SELECT ${DUTY_COLUMNS.join(', ')} FROM scheduled_duties`),
    db.getAllAsync<JsonRow>(`SELECT ${EXCEPTION_COLUMNS.join(', ')} FROM schedule_exceptions`),
    db.getAllAsync<JsonRow>(`SELECT ${TOMBSTONE_COLUMNS.join(', ')} FROM sync_tombstones`),
    getOrCreateDeviceId(db),
  ]);
  return { deviceId, settings, series, duties, exceptions, tombstones };
}

function values(row: JsonRow, columns: readonly string[]): SQLiteBindValue[] {
  return columns.map((column) => row[column] as SQLiteBindValue);
}

async function insertRows(
  db: SQLiteDatabase,
  table: 'schedule_series' | 'scheduled_duties' | 'schedule_exceptions' | 'sync_tombstones',
  rows: JsonRow[],
  columns: readonly string[],
) {
  const placeholders = columns.map(() => '?').join(', ');
  for (const row of rows) {
    await db.runAsync(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      ...values(row, columns),
    );
  }
}

async function applyRemoteSnapshot(db: SQLiteDatabase, remote: SyncSnapshot, ownerId: string) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM schedule_exceptions;
      DELETE FROM scheduled_duties;
      DELETE FROM schedule_series;
      DELETE FROM settings;
      DELETE FROM sync_tombstones;
    `);

    if (remote.settings) {
      await db.runAsync(
        `INSERT INTO settings (${SETTINGS_COLUMNS.join(', ')})
         VALUES (${SETTINGS_COLUMNS.map(() => '?').join(', ')})`,
        ...values(remote.settings, SETTINGS_COLUMNS),
      );
    }
    await insertRows(db, 'schedule_series', remote.series, SERIES_COLUMNS);
    await insertRows(db, 'scheduled_duties', remote.duties, DUTY_COLUMNS);
    await insertRows(db, 'schedule_exceptions', remote.exceptions, EXCEPTION_COLUMNS);
    await insertRows(db, 'sync_tombstones', remote.tombstones, TOMBSTONE_COLUMNS);
    await setSyncState(db, 'owner_id', ownerId);
    await setSyncState(db, 'last_sync_at', String(Date.now()));
  });
}

function isSnapshot(value: unknown): value is SyncSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SyncSnapshot>;
  return (candidate.settings === null || typeof candidate.settings === 'object')
    && Array.isArray(candidate.series)
    && Array.isArray(candidate.duties)
    && Array.isArray(candidate.exceptions)
    && Array.isArray(candidate.tombstones);
}

/** Merges the local snapshot and applies the server's canonical account state. */
export async function syncAccount(db: SQLiteDatabase, ownerId: string) {
  if (!supabase) throw new Error('Cloud sync is not configured for this build.');
  const client = supabase;

  return runSerializedWrite(async () => {
    const currentOwner = await accountOwner(db);
    if (currentOwner && currentOwner !== ownerId) {
      await db.withTransactionAsync(() => clearAccountRows(db));
    }
    await setSyncState(db, 'owner_id', ownerId);

    const { data, error } = await client.rpc('sync_ignis_snapshot', {
      p_snapshot: await createSnapshot(db),
    });
    if (error) throw error;
    if (!isSnapshot(data)) throw new Error('Cloud sync returned an invalid schedule snapshot.');

    await applyRemoteSnapshot(db, data, ownerId);
    return getSyncState(db, 'last_sync_at');
  });
}

export async function lastSyncAt(db: SQLiteDatabase) {
  return getSyncState(db, 'last_sync_at');
}
