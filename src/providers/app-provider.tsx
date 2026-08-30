import type { Session } from '@supabase/supabase-js';
import { getCalendars, getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isGoogleSignInAvailable, signInWithGoogle as startGoogleSignIn } from '@/src/data/oauth';
import {
  deleteSchedule as deleteScheduleRecord,
  ensureDutyWindow,
  getSettings,
  listDuties,
  listSeries,
  saveSchedule as saveScheduleRecord,
  saveSettings as saveSettingsRecord,
  updateAttendance as updateAttendanceRecord,
} from '@/src/data/repository';
import { isSupabaseConfigured, supabase } from '@/src/data/supabase';
import { clearAccountData, syncAccount } from '@/src/data/sync';
import { localDateKey } from '@/src/domain/format';
import { getPayPeriod } from '@/src/domain/periods';
import { nextMaterializationEnd } from '@/src/domain/schedule';
import { AppSettings, AttendanceStatus, ScheduledDuty, ScheduleEditScope, ScheduleInput, ScheduleSeries } from '@/src/types';

export type SyncStatus = 'local-only' | 'idle' | 'syncing' | 'error';

export type Account = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type AppData = {
  loading: boolean;
  error: string | null;
  settings: AppSettings;
  duties: ScheduledDuty[];
  series: ScheduleSeries[];
  refresh: () => Promise<void>;
  ensureWindow: (start: Date, end: Date) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  saveSchedule: (input: ScheduleInput) => Promise<void>;
  setAttendance: (dutyId: string, status: AttendanceStatus) => Promise<void>;
  deleteSchedule: (dutyId: string, scope: ScheduleEditScope) => Promise<void>;
  account: Account | null;
  cloudConfigured: boolean;
  googleSignInAvailable: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  signInWithGoogle: () => Promise<boolean>;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AppDataContext = createContext<AppData | null>(null);

function makeDefaults(): AppSettings {
  const locale = getLocales()[0];
  const calendar = getCalendars()[0];
  const today = new Date();
  return {
    onboardingCompleted: false,
    currencyCode: locale?.currencyCode ?? 'USD',
    hourlyRateMinor: 0,
    payCycleType: 'biweekly',
    payCycleAnchor: localDateKey(today),
    overtimeMode: 'daily',
    overtimeThresholdMinutes: 480,
    overtimeMultiplierBps: 15_000,
    nightDifferentialBps: 1_000,
    nightDifferentialStartMinutes: 22 * 60,
    nightDifferentialEndMinutes: 6 * 60,
    weekStartsOn: Math.max(0, Math.min(6, (calendar?.firstWeekday ?? 2) - 1)),
  };
}

function accountFromSession(session: Session | null): Account | null {
  if (!session) return null;
  const metadata = session.user.user_metadata;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    displayName: typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string' ? metadata.name : null,
    avatarUrl: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
  };
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(makeDefaults);
  const [duties, setDuties] = useState<ScheduledDuty[]>([]);
  const [series, setSeries] = useState<ScheduleSeries[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const storedSettings = await getSettings(db);
      const effectiveSettings = storedSettings ?? makeDefaults();
      const period = getPayPeriod(new Date(), effectiveSettings);
      await ensureDutyWindow(db, localDateKey(period.start), nextMaterializationEnd());
      const [storedDuties, storedSeries] = await Promise.all([listDuties(db), listSeries(db)]);
      setSettings(effectiveSettings);
      setDuties(storedDuties);
      setSeries(storedSeries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ignis could not read its local schedule.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (!session || !supabase) {
      setSyncStatus('local-only');
      return;
    }
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const syncedAt = await syncAccount(db, session.user.id);
      setLastSyncedAt(syncedAt);
      await refresh();
      setSyncStatus('idle');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Cloud sync could not complete.';
      setSyncError(`${message} Your changes are still saved on this device.`);
      setSyncStatus('error');
      throw cause;
    }
  }, [db, refresh, session]);

  useEffect(() => {
    if (session) syncNow().catch(() => undefined);
    else {
      setSyncStatus('local-only');
      setLastSyncedAt(null);
      setSyncError(null);
    }
  }, [session, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session) syncNow().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [session, syncNow]);

  useEffect(() => () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
  }, []);

  const scheduleSync = useCallback(() => {
    if (!session) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      syncNow().catch(() => undefined);
    }, 750);
  }, [session, syncNow]);

  const runMutation = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
      await refresh();
      scheduleSync();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The schedule could not be updated.');
      throw cause;
    }
  }, [refresh, scheduleSync]);

  const ensureWindow = useCallback(async (start: Date, end: Date) => {
    try {
      setError(null);
      await ensureDutyWindow(db, localDateKey(start), localDateKey(end));
      const [storedDuties, storedSeries] = await Promise.all([listDuties(db), listSeries(db)]);
      setDuties(storedDuties);
      setSeries(storedSeries);
      scheduleSync();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That schedule period could not be opened.');
      throw cause;
    }
  }, [db, scheduleSync]);

  const signOut = useCallback(async () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    const authError = supabase ? (await supabase.auth.signOut({ scope: 'local' })).error : null;
    await clearAccountData(db);
    setSession(null);
    setSyncStatus('local-only');
    setLastSyncedAt(null);
    setSyncError(null);
    await refresh();
    if (authError) throw authError;
  }, [db, refresh]);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !session) throw new Error('Sign in before deleting an account.');
    if (syncTimer.current) clearTimeout(syncTimer.current);
    const { error: deleteError } = await supabase.functions.invoke('delete-account');
    if (deleteError) throw deleteError;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await clearAccountData(db);
    setSession(null);
    setSyncStatus('local-only');
    setLastSyncedAt(null);
    setSyncError(null);
    await refresh();
  }, [db, refresh, session]);

  const value = useMemo<AppData>(() => ({
    loading,
    error,
    settings,
    duties,
    series,
    refresh,
    ensureWindow,
    saveSettings: async (next) => runMutation(() => saveSettingsRecord(db, next)),
    saveSchedule: async (input) => runMutation(() => saveScheduleRecord(db, input)),
    setAttendance: async (dutyId, status) => runMutation(() => updateAttendanceRecord(db, dutyId, status)),
    deleteSchedule: async (dutyId, scope) => runMutation(() => deleteScheduleRecord(db, dutyId, scope)),
    account: accountFromSession(session),
    cloudConfigured: isSupabaseConfigured,
    googleSignInAvailable: isGoogleSignInAvailable,
    syncStatus,
    lastSyncedAt,
    syncError,
    signInWithGoogle: startGoogleSignIn,
    syncNow,
    signOut,
    deleteAccount,
  }), [db, deleteAccount, duties, ensureWindow, error, lastSyncedAt, loading, refresh, runMutation, series, session, settings, signOut, syncError, syncNow, syncStatus]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}
