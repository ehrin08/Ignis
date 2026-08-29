import { getCalendars, getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import * as Linking from 'expo-linking';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';

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
import { localDateKey } from '@/src/domain/format';
import { getPayPeriod } from '@/src/domain/periods';
import { nextMaterializationEnd } from '@/src/domain/schedule';
import { AppSettings, AttendanceStatus, ScheduledDuty, ScheduleEditScope, ScheduleInput, ScheduleSeries } from '@/src/types';
import { clearAccountData, lastSyncAt, syncAccount } from '@/src/data/sync';
import { isSupabaseConfigured, supabase } from '@/src/data/supabase';
import { isGoogleSignInAvailable, signInWithGoogle as startGoogleSignIn } from '@/src/data/oauth';

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
  cloudConfigured: boolean;
  session: Session | null;
  syncing: boolean;
  lastSyncedAt: string | null;
  googleSignInAvailable: boolean;
  signInWithGoogle: () => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<boolean>;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
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

export function AppDataProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(makeDefaults);
  const [duties, setDuties] = useState<ScheduledDuty[]>([]);
  const [series, setSeries] = useState<ScheduleSeries[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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

  const syncNow = useCallback(async () => {
    if (!supabase || !session) return;
    setSyncing(true);
    try {
      await syncAccount(db);
      setLastSyncedAt(await lastSyncAt(db));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cloud sync could not complete. Your changes are still on this device.');
      throw cause;
    } finally {
      setSyncing(false);
    }
  }, [db, refresh, session]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) syncNow().catch(() => undefined);
  }, [session, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session) syncNow().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [session, syncNow]);

  const runMutation = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
      await refresh();
      if (session) syncNow().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The schedule could not be updated.');
      throw cause;
    }
  }, [refresh, session, syncNow]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sync is not configured for this build.');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) throw authError;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sync is not configured for this build.');
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: Linking.createURL('auth/callback') },
    });
    if (authError) throw authError;
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    await clearAccountData(db);
    setSession(null);
    setLastSyncedAt(null);
    await refresh();
  }, [db, refresh]);

  const ensureWindow = useCallback(async (start: Date, end: Date) => {
    try {
      setError(null);
      await ensureDutyWindow(db, localDateKey(start), localDateKey(end));
      const [storedDuties, storedSeries] = await Promise.all([listDuties(db), listSeries(db)]);
      setDuties(storedDuties);
      setSeries(storedSeries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That schedule period could not be opened.');
      throw cause;
    }
  }, [db]);

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
    cloudConfigured: isSupabaseConfigured,
    session,
    syncing,
    lastSyncedAt,
    googleSignInAvailable: isGoogleSignInAvailable,
    signInWithGoogle: startGoogleSignIn,
    signInWithPassword,
    signUpWithPassword,
    syncNow,
    signOut,
  }), [db, duties, ensureWindow, error, lastSyncedAt, loading, refresh, runMutation, series, session, settings, signInWithPassword, signOut, signUpWithPassword, syncNow, syncing]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}
