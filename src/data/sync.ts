import { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { supabase } from '@/src/data/supabase';
import { runWriteTransaction } from '@/src/data/transactions';

type SyncSnapshot = {
  deviceId: string;
  settings: Record<string, unknown> | null;
  series: Record<string, unknown>[];
  duties: Record<string, unknown>[];
  exceptions: Record<string, unknown>[];
  tombstones: Record<string, unknown>[];
};

async function deviceId(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'device_id'");
  if (row) return row.value;
  const value = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('device_id', ?)", value);
  return value;
}

export async function accountOwner(db: SQLiteDatabase) {
  return (await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'owner_id'"))?.value ?? null;
}

export async function prepareAccount(db: SQLiteDatabase, ownerId: string) {
  const current = await accountOwner(db);
  if (current && current !== ownerId) await clearAccountData(db);
  await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('owner_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ownerId);
}

export async function clearAccountData(db: SQLiteDatabase) {
  await runWriteTransaction(db, async (tx) => {
    await tx.execAsync(`DELETE FROM schedule_exceptions; DELETE FROM scheduled_duties; DELETE FROM schedule_series;
      DELETE FROM settings; DELETE FROM sync_tombstones; DELETE FROM sync_state WHERE key = 'owner_id';`);
  });
}

async function snapshot(db: SQLiteDatabase): Promise<SyncSnapshot> {
  const [settings, series, duties, exceptions, tombstones] = await Promise.all([
    db.getFirstAsync<Record<string, unknown>>('SELECT * FROM settings WHERE id = 1'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM schedule_series'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM scheduled_duties'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM schedule_exceptions'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM sync_tombstones'),
  ]);
  return { deviceId: await deviceId(db), settings, series, duties, exceptions, tombstones };
}

/** Pushes the compact local snapshot and applies the server's canonical state atomically. */
export async function syncAccount(db: SQLiteDatabase) {
  if (!supabase) throw new Error('Cloud sync is not configured for this build.');
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('Sign in before syncing.');
  await prepareAccount(db, sessionData.session.user.id);
  const { data, error } = await supabase.rpc('sync_ignis_snapshot', { p_snapshot: await snapshot(db) });
  if (error) throw error;
  const remote = data as SyncSnapshot | null;
  if (!remote) return;
  await applyRemoteSnapshot(db, remote);
  await db.runAsync("INSERT INTO sync_state (key, value) VALUES ('last_sync_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", String(Date.now()));
}

async function applyRemoteSnapshot(db: SQLiteDatabase, remote: SyncSnapshot) {
  await runWriteTransaction(db, async (tx) => {
    // The RPC has already merged timestamps and tombstones. Replacing local records avoids partial cross-device state.
    await tx.execAsync('DELETE FROM schedule_exceptions; DELETE FROM scheduled_duties; DELETE FROM schedule_series; DELETE FROM settings; DELETE FROM sync_tombstones;');
    if (remote.settings) {
      const row = remote.settings;
      const columns = Object.keys(row);
      await tx.runAsync(`INSERT INTO settings (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, ...columns.map((key) => row[key] as SQLiteBindValue));
    }
    for (const [table, rows] of [['schedule_series', remote.series], ['scheduled_duties', remote.duties], ['schedule_exceptions', remote.exceptions], ['sync_tombstones', remote.tombstones]] as const) {
      for (const row of rows) {
        const columns = Object.keys(row);
        await tx.runAsync(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, ...columns.map((key) => row[key] as SQLiteBindValue));
      }
    }
  });
}

export async function lastSyncAt(db: SQLiteDatabase) {
  return (await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_state WHERE key = 'last_sync_at'"))?.value ?? null;
}
