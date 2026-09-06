import type { SQLiteDatabase } from 'expo-sqlite';

import { runWriteTransaction } from '@/src/data/transactions';
import { BudgetCategory, BudgetEntry, BudgetEntryInput, summarizeBudget, validateBudgetEntry, validateCategoryName } from '@/src/domain/budget';

export type BudgetSnapshot = { entries: BudgetEntry[]; categories: BudgetCategory[] };
const entryColumns = 'id, kind, amount_minor AS amountMinor, entry_date AS date, description, category_id AS categoryId, created_at AS createdAt, updated_at AS updatedAt';
const categoryColumns = 'id, name, archived, created_at AS createdAt, updated_at AS updatedAt';

async function readSnapshot(db: SQLiteDatabase): Promise<BudgetSnapshot> {
  const entries = await db.getAllAsync<BudgetEntry>(`SELECT ${entryColumns} FROM budget_entries ORDER BY entry_date DESC, created_at DESC, id DESC`);
  const rows = await db.getAllAsync<Omit<BudgetCategory, 'archived'> & { archived: number }>(`SELECT ${categoryColumns} FROM budget_categories ORDER BY archived, name COLLATE NOCASE, id`);
  return { entries, categories: rows.map((row) => ({ ...row, archived: Boolean(row.archived) })) };
}

export function loadBudget(db: SQLiteDatabase) {
  return runWriteTransaction(db, readSnapshot);
}

export function saveBudgetEntry(db: SQLiteDatabase, input: BudgetEntryInput, editing = false) {
  return runWriteTransaction(db, async (transaction) => {
    validateBudgetEntry(input);
    const snapshot = await readSnapshot(transaction);
    const existing = snapshot.entries.find((entry) => entry.id === input.id);
    if (editing && !existing) throw new Error('This budget entry no longer exists.');
    if (!editing && existing) throw new Error('This budget entry has already been saved.');
    if (input.kind === 'expense') {
      const category = snapshot.categories.find((item) => item.id === input.categoryId);
      if (!category || (category.archived && existing?.categoryId !== category.id)) throw new Error('Choose an active expense category.');
    }
    summarizeBudget([...snapshot.entries.filter((entry) => entry.id !== input.id), input]);
    const now = Date.now();
    await transaction.runAsync(
      `INSERT INTO budget_entries (id, kind, amount_minor, entry_date, description, category_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, amount_minor = excluded.amount_minor,
       entry_date = excluded.entry_date, description = excluded.description, category_id = excluded.category_id, updated_at = excluded.updated_at`,
      input.id, input.kind, input.amountMinor, input.date, input.description.trim(), input.categoryId, existing?.createdAt ?? now, now,
    );
    return readSnapshot(transaction);
  });
}

export function deleteBudgetEntry(db: SQLiteDatabase, id: string) {
  return runWriteTransaction(db, async (transaction) => {
    await transaction.runAsync('DELETE FROM budget_entries WHERE id = ?', id);
    return readSnapshot(transaction);
  });
}

export function saveBudgetCategory(db: SQLiteDatabase, id: string, value: string, editing = false) {
  return runWriteTransaction(db, async (transaction) => {
    const name = validateCategoryName(value);
    const snapshot = await readSnapshot(transaction);
    const existing = snapshot.categories.find((item) => item.id === id);
    if (editing && !existing) throw new Error('This category no longer exists.');
    if (!editing && existing) throw new Error('This category has already been saved.');
    if (snapshot.categories.some((item) => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('A category with this name already exists, including archived categories.');
    }
    const now = Date.now();
    await transaction.runAsync(
      `INSERT INTO budget_categories (id, name, archived, created_at, updated_at) VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
      id, name, now, now,
    );
    return readSnapshot(transaction);
  });
}

export function setBudgetCategoryArchived(db: SQLiteDatabase, id: string, archived: boolean) {
  return runWriteTransaction(db, async (transaction) => {
    await transaction.runAsync('UPDATE budget_categories SET archived = ?, updated_at = ? WHERE id = ?', archived ? 1 : 0, Date.now(), id);
    return readSnapshot(transaction);
  });
}
