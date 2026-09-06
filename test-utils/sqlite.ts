import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Real SQLite adapter for persistence tests; no native Expo bridge or network. */
export function openTestDatabase(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
  const adapter = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    getFirstAsync: async (sql: string, ...values: SQLInputValue[]) => sqlite.prepare(sql).get(...values) ?? null,
    getAllAsync: async (sql: string, ...values: SQLInputValue[]) => sqlite.prepare(sql).all(...values),
    runAsync: async (sql: string, ...values: SQLInputValue[]) => sqlite.prepare(sql).run(...values),
    withTransactionAsync: async (callback: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try { await callback(); sqlite.exec('COMMIT'); }
      catch (cause) { sqlite.exec('ROLLBACK'); throw cause; }
    },
  };
  return { sqlite, db: adapter as unknown as SQLiteDatabase };
}
