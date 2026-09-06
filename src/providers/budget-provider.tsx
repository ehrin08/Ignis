import { useSQLiteContext } from 'expo-sqlite';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { BudgetSnapshot, deleteBudgetEntry, loadBudget, saveBudgetCategory, saveBudgetEntry, setBudgetCategoryArchived } from '@/src/data/budget-repository';
import { BudgetEntryInput, summarizeBudget } from '@/src/domain/budget';

type BudgetData = BudgetSnapshot & {
  loading: boolean;
  error: string | null;
  totals: ReturnType<typeof summarizeBudget>;
  refresh: () => Promise<void>;
  saveEntry: (input: BudgetEntryInput, editing?: boolean) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveCategory: (id: string, name: string, editing?: boolean) => Promise<void>;
  archiveCategory: (id: string, archived: boolean) => Promise<void>;
};
const BudgetContext = createContext<BudgetData | null>(null);

export function BudgetProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<BudgetSnapshot>({ entries: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const apply = useCallback(async (operation: () => Promise<BudgetSnapshot>) => {
    try {
      const next = await operation();
      if (mounted.current) { setSnapshot(next); setError(null); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'The budget could not be updated. Try again.');
      throw cause;
    }
  }, []);
  const refresh = useCallback(() => apply(() => loadBudget(db)), [apply, db]);

  useEffect(() => {
    mounted.current = true;
    refresh().catch(() => undefined).finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [refresh]);

  const value = useMemo<BudgetData>(() => ({
    ...snapshot, loading, error, refresh, totals: summarizeBudget(snapshot.entries),
    saveEntry: (input, editing) => apply(() => saveBudgetEntry(db, input, editing)),
    deleteEntry: (id) => apply(() => deleteBudgetEntry(db, id)),
    saveCategory: (id, name, editing) => apply(() => saveBudgetCategory(db, id, name, editing)),
    archiveCategory: (id, archived) => apply(() => setBudgetCategoryArchived(db, id, archived)),
  }), [snapshot, loading, error, refresh, apply, db]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) throw new Error('useBudget must be used inside BudgetProvider');
  return context;
}
