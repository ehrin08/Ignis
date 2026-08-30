import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSyncState(db: SQLiteDatabase, key: string) {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', key))?.value ?? null;
}

export async function setSyncState(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function removeSyncState(db: SQLiteDatabase, ...keys: string[]) {
  for (const key of keys) await db.runAsync('DELETE FROM sync_state WHERE key = ?', key);
}

export async function getOrCreateDeviceId(db: SQLiteDatabase) {
  const current = await getSyncState(db, 'device_id');
  if (current) return current;
  const value = randomUUID();
  await setSyncState(db, 'device_id', value);
  return value;
}
