import { getCalendars, getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

  const runMutation = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The schedule could not be updated.');
      throw cause;
    }
  }, [refresh]);

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
  }), [db, duties, ensureWindow, error, loading, refresh, runMutation, series, settings]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}
