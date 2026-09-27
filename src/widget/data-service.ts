import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

import type { AppSettings, ScheduledDuty } from '@/src/types';
import { findNextUpcomingDuty, wallClockDate } from '@/src/domain/schedule';
import { formatCurrency } from '@/src/domain/format';
import { calculateDashboardSummary } from '@/src/domain/pay';
import { getPayPeriod } from '@/src/domain/periods';

export type WidgetSnapshot = {
  updatedAt: number;
  nextDuty: {
    time: string;
    date: string;
    note: string;
  } | null;
  periodTotals: {
    earned: string;
    projected: string;
  };
};

const SNAPSHOT_FILENAME = 'widget-data.json';

function getSnapshotFile(): File {
  return new File(Paths.document, SNAPSHOT_FILENAME);
}

/** Write a fresh snapshot. Called after every data mutation. */
export async function writeWidgetSnapshot(
  duties: ScheduledDuty[],
  settings: AppSettings,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const now = new Date();
  const nextDuty = findNextUpcomingDuty(duties, now);
  const period = getPayPeriod(now, settings);
  const summary = calculateDashboardSummary(duties, settings, period, now);

  let nextDutyData: WidgetSnapshot['nextDuty'] = null;
  if (nextDuty) {
    const startWall = wallClockDate(nextDuty.scheduledStart, nextDuty.timezone);
    const timeStr = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(startWall);
    const dateStr = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(startWall);
    nextDutyData = { time: timeStr, date: dateStr, note: nextDuty.note };
  }

  const snapshot: WidgetSnapshot = {
    updatedAt: now.getTime(),
    nextDuty: nextDutyData,
    periodTotals: {
      earned: formatCurrency(summary.earned.grossMinor, settings.currencyCode),
      projected: formatCurrency(summary.projected.grossMinor, settings.currencyCode),
    },
  };

  try {
    await getSnapshotFile().write(JSON.stringify(snapshot));
  } catch {
    // Non-critical — widget will show stale data
  }
}

/** Read snapshot from disk (used by headless task handler). */
export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const file = getSnapshotFile();
    if (!file.exists) return null;
    const raw = await file.text();
    return JSON.parse(raw) as WidgetSnapshot;
  } catch {
    return null;
  }
}
