/** @jest-environment node */
import { mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { deleteBudgetEntry, loadBudget, saveBudgetCategory, saveBudgetEntry, setBudgetCategoryArchived } from '@/src/data/budget-repository';
import { migrateDatabase } from '@/src/data/migrations';
import { clearAccountData, syncAccount } from '@/src/data/sync';
import { supabase } from '@/src/data/supabase';
import { BudgetEntryInput, DEFAULT_BUDGET_CATEGORIES, summarizeBudget } from '@/src/domain/budget';
import { openTestDatabase } from '@/test-utils/sqlite';

jest.mock('@/src/data/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'test-device') }));
const rpc = supabase!.rpc as jest.Mock;
const funds: BudgetEntryInput = { id: 'funds', kind: 'funds', amountMinor: 10000, date: '2020-01-01', description: 'Cash', categoryId: null };
const expense: BudgetEntryInput = { id: 'expense', kind: 'expense', amountMinor: 12500, date: '2020-01-02', description: 'Lunch', categoryId: 'food' };

describe('budget SQLite persistence and isolation', () => {
  let connection: ReturnType<typeof openTestDatabase>;
  beforeEach(async () => {
    connection = openTestDatabase();
    await migrateDatabase(connection.db);
    rpc.mockReset();
  });
  afterEach(() => connection.sqlite.close());

  test('fresh install seeds categories once with an empty balance', async () => {
    await migrateDatabase(connection.db);
    const budget = await loadBudget(connection.db);
    expect(budget.entries).toEqual([]);
    expect(budget.categories.map((category) => category.name).sort()).toEqual([...DEFAULT_BUDGET_CATEGORIES].sort());
    expect(connection.sqlite.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 8 });
  });

  test('v6 upgrade preserves completed schedule history and pay configuration', async () => {
    connection.sqlite.exec(`
      DROP TABLE budget_entries; DROP TABLE budget_categories;
      ALTER TABLE settings DROP COLUMN notify_upcoming_duty;
      ALTER TABLE settings DROP COLUMN notify_upcoming_lead_minutes;
      ALTER TABLE settings DROP COLUMN notify_overdue_attendance;
      ALTER TABLE settings DROP COLUMN notify_daily_summary;
      ALTER TABLE settings DROP COLUMN notify_daily_summary_hour;
      PRAGMA user_version = 6;
      INSERT INTO settings (id, currency_code, hourly_rate_minor, pay_cycle_anchor, updated_at) VALUES (1, 'USD', 777, '2020-01-01', 1);
      INSERT INTO scheduled_duties (id, occurrence_date, scheduled_start, scheduled_end, timezone, status, created_at, updated_at)
      VALUES ('history', '2020-01-01', 1, 2, 'UTC', 'completed', 1, 1);
    `);
    const before = connection.sqlite.prepare('SELECT * FROM scheduled_duties').all();
    const settings = connection.sqlite.prepare('SELECT * FROM settings').all();
    await migrateDatabase(connection.db);
    expect(connection.sqlite.prepare('SELECT * FROM scheduled_duties').all()).toEqual(before);
    expect(connection.sqlite.prepare('SELECT * FROM settings').all()).toMatchObject(settings);
    expect((await loadBudget(connection.db)).entries).toEqual([]);
  });

  test('inserts, edits, deletes and orders transactions across months', async () => {
    await saveBudgetEntry(connection.db, funds);
    let snapshot = await saveBudgetEntry(connection.db, expense);
    expect(snapshot.entries.map((entry) => entry.id)).toEqual(['expense', 'funds']);
    expect(summarizeBudget(snapshot.entries).balanceMinor).toBe(-2500);
    const createdAt = snapshot.entries[0].createdAt;
    snapshot = await saveBudgetEntry(connection.db, { ...expense, date: '2020-02-01', amountMinor: 2500 }, true);
    expect(snapshot.entries[0].createdAt).toBe(createdAt);
    expect(summarizeBudget(snapshot.entries).balanceMinor).toBe(7500);
    snapshot = await deleteBudgetEntry(connection.db, funds.id);
    expect(summarizeBudget(snapshot.entries).balanceMinor).toBe(-2500);
    await expect(saveBudgetEntry(connection.db, funds, true)).rejects.toThrow(/no longer exists/);
  });

  test('archives categories without losing history and restores them', async () => {
    await saveBudgetEntry(connection.db, expense);
    await saveBudgetCategory(connection.db, 'food', 'Meals', true);
    await setBudgetCategoryArchived(connection.db, 'food', true);
    await expect(saveBudgetEntry(connection.db, { ...expense, id: 'new' })).rejects.toThrow(/active/);
    const snapshot = await saveBudgetEntry(connection.db, { ...expense, description: 'Corrected' }, true);
    expect(snapshot.entries[0]).toMatchObject({ categoryId: 'food', description: 'Corrected' });
    expect(snapshot.categories.find((category) => category.id === 'food')).toMatchObject({ name: 'Meals', archived: true });
    await expect(saveBudgetCategory(connection.db, 'custom', ' meals ')).rejects.toThrow(/already exists/);
    await setBudgetCategoryArchived(connection.db, 'food', false);
    await saveBudgetEntry(connection.db, { ...expense, id: 'new' });
    expect(() => connection.sqlite.exec("DELETE FROM budget_categories WHERE id = 'food'")).toThrow();
  });

  test('rejects duplicate submissions, invalid categories and aggregate overflow', async () => {
    await saveBudgetEntry(connection.db, { ...funds, amountMinor: Number.MAX_SAFE_INTEGER });
    await expect(saveBudgetEntry(connection.db, funds)).rejects.toThrow(/already been saved/);
    await expect(saveBudgetEntry(connection.db, { ...funds, id: 'more' })).rejects.toThrow(/total exceeds/);
    await expect(saveBudgetEntry(connection.db, { ...expense, categoryId: 'missing' })).rejects.toThrow(/active/);
    expect((await loadBudget(connection.db)).entries).toHaveLength(1);
  });

  test('rolls back failed saves and permits a successful retry', async () => {
    await saveBudgetEntry(connection.db, funds);
    connection.sqlite.exec("CREATE TRIGGER reject_budget BEFORE INSERT ON budget_entries BEGIN SELECT RAISE(ABORT, 'Disk write failed'); END");
    await expect(saveBudgetEntry(connection.db, expense)).rejects.toThrow(/Disk write failed/);
    expect((await loadBudget(connection.db)).entries.map((entry) => entry.id)).toEqual(['funds']);
    connection.sqlite.exec('DROP TRIGGER reject_budget');
    expect((await saveBudgetEntry(connection.db, expense)).entries).toHaveLength(2);
  });

  test('budget writes never call sync; account sync, switching and clearing preserve budget', async () => {
    await saveBudgetEntry(connection.db, funds);
    await saveBudgetEntry(connection.db, expense);
    const before = await loadBudget(connection.db);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { deviceId: 'server', settings: null, series: [], duties: [], exceptions: [], tombstones: [] }, error: null });
    await syncAccount(connection.db, 'account-one');
    await syncAccount(connection.db, 'account-two');
    const payload = rpc.mock.calls[0][1].p_snapshot;
    expect(Object.keys(payload).sort()).toEqual(['deviceId', 'settings', 'series', 'duties', 'exceptions', 'tombstones'].sort());
    expect(JSON.stringify(payload)).not.toContain('Cash');
    expect(await loadBudget(connection.db)).toEqual(before);
    rpc.mockResolvedValue({ data: null, error: new Error('Offline') });
    await expect(syncAccount(connection.db, 'account-two')).rejects.toThrow('Offline');
    await clearAccountData(connection.db);
    expect(await loadBudget(connection.db)).toEqual(before);
  });

  test('survives closing and reopening the database', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ignis-budget-'));
    const path = join(directory, 'budget.db');
    let disk = openTestDatabase(path);
    try {
      await migrateDatabase(disk.db);
      await saveBudgetEntry(disk.db, funds);
      await saveBudgetEntry(disk.db, expense);
      disk.sqlite.close();
      disk = openTestDatabase(path);
      await migrateDatabase(disk.db);
      expect(summarizeBudget((await loadBudget(disk.db)).entries).balanceMinor).toBe(-2500);
    } finally {
      disk.sqlite.close();
      for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
      rmdirSync(directory);
    }
  });
});
