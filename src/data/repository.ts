import { SQLiteDatabase } from 'expo-sqlite';

import { generateOccurrences, nextMaterializationEnd, parseLocalDate, seriesFromInput, scheduledRange } from '@/src/domain/schedule';
import { getOrCreateDeviceId } from '@/src/data/sync-state';
import { runWriteTransaction } from '@/src/data/transactions';
import { AppSettings, AttendanceStatus, RateOverride, ScheduledDuty, ScheduleEditScope, ScheduleInput, ScheduleSeries } from '@/src/types';

type SettingsRow = {
  onboarding_completed: number;
  currency_code: string;
  hourly_rate_minor: number;
  pay_cycle_type: AppSettings['payCycleType'];
  pay_cycle_anchor: string;
  overtime_mode: AppSettings['overtimeMode'];
  overtime_threshold_minutes: number;
  overtime_multiplier_bps: number;
  night_differential_bps: number;
  night_differential_start_minutes: number;
  night_differential_end_minutes: number;
  week_starts_on: number;
};

type SeriesRow = {
  id: string;
  recurrence: ScheduleSeries['recurrence'];
  start_date: string;
  end_date: string | null;
  weekday_mask: string;
  start_minutes: number;
  end_minutes: number;
  timezone: string;
  break_seconds: number;
  rate_override_type: RateOverride['type'] | null;
  rate_override_minor: number | null;
  note: string;
  generated_through: string | null;
  created_at: number;
  updated_at: number;
};

type DutyRow = {
  id: string;
  series_id: string | null;
  occurrence_date: string;
  scheduled_start: number;
  scheduled_end: number | null;
  timezone: string;
  break_seconds: number;
  rate_override_type: RateOverride['type'] | null;
  rate_override_minor: number | null;
  status: AttendanceStatus;
  needs_review: number;
  note: string;
  created_at: number;
  updated_at: number;
};

const toRateOverride = (type: RateOverride['type'] | null, amountMinor: number | null): RateOverride | null =>
  type === null || amountMinor === null ? null : { type, amountMinor };

const toSeries = (row: SeriesRow): ScheduleSeries => ({
  id: row.id,
  recurrence: row.recurrence,
  startDate: row.start_date,
  endDate: row.end_date,
  weekdayMask: row.weekday_mask.split(',').map(Number).filter(Number.isFinite),
  startMinutes: row.start_minutes,
  endMinutes: row.end_minutes,
  timezone: row.timezone,
  breakSeconds: row.break_seconds,
  rateOverride: toRateOverride(row.rate_override_type, row.rate_override_minor),
  note: row.note,
  generatedThrough: row.generated_through,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDuty = (row: DutyRow): ScheduledDuty => ({
  id: row.id,
  seriesId: row.series_id,
  occurrenceDate: row.occurrence_date,
  scheduledStart: row.scheduled_start,
  scheduledEnd: row.scheduled_end,
  timezone: row.timezone,
  breakSeconds: row.break_seconds,
  rateOverride: toRateOverride(row.rate_override_type, row.rate_override_minor),
  status: row.status,
  needsReview: Boolean(row.needs_review),
  note: row.note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getSettings(db: SQLiteDatabase): Promise<AppSettings | null> {
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1');
  if (!row) return null;
  return {
    onboardingCompleted: Boolean(row.onboarding_completed),
    currencyCode: row.currency_code,
    hourlyRateMinor: row.hourly_rate_minor,
    payCycleType: row.pay_cycle_type,
    payCycleAnchor: row.pay_cycle_anchor,
    overtimeMode: row.overtime_mode,
    overtimeThresholdMinutes: row.overtime_threshold_minutes,
    overtimeMultiplierBps: row.overtime_multiplier_bps,
    nightDifferentialBps: row.night_differential_bps,
    nightDifferentialStartMinutes: row.night_differential_start_minutes,
    nightDifferentialEndMinutes: row.night_differential_end_minutes,
    weekStartsOn: row.week_starts_on,
  };
}

export async function saveSettings(db: SQLiteDatabase, settings: AppSettings) {
  await db.runAsync(
    `INSERT INTO settings (
      id, onboarding_completed, currency_code, hourly_rate_minor, pay_cycle_type,
      pay_cycle_anchor, overtime_mode, overtime_threshold_minutes,
      overtime_multiplier_bps, night_differential_bps, night_differential_start_minutes,
      night_differential_end_minutes, week_starts_on, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      onboarding_completed = excluded.onboarding_completed,
      currency_code = excluded.currency_code,
      hourly_rate_minor = excluded.hourly_rate_minor,
      pay_cycle_type = excluded.pay_cycle_type,
      pay_cycle_anchor = excluded.pay_cycle_anchor,
      overtime_mode = excluded.overtime_mode,
      overtime_threshold_minutes = excluded.overtime_threshold_minutes,
      overtime_multiplier_bps = excluded.overtime_multiplier_bps,
      night_differential_bps = excluded.night_differential_bps,
      night_differential_start_minutes = excluded.night_differential_start_minutes,
      night_differential_end_minutes = excluded.night_differential_end_minutes,
      week_starts_on = excluded.week_starts_on,
      updated_at = excluded.updated_at`,
    settings.onboardingCompleted ? 1 : 0,
    settings.currencyCode.toUpperCase(),
    settings.hourlyRateMinor,
    settings.payCycleType,
    settings.payCycleAnchor,
    settings.overtimeMode,
    settings.overtimeThresholdMinutes,
    settings.overtimeMultiplierBps,
    settings.nightDifferentialBps,
    settings.nightDifferentialStartMinutes,
    settings.nightDifferentialEndMinutes,
    settings.weekStartsOn,
    Date.now(),
  );
}

export async function listDuties(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<DutyRow>('SELECT * FROM scheduled_duties ORDER BY scheduled_start ASC');
  return rows.map(toDuty);
}

export async function listSeries(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<SeriesRow>('SELECT * FROM schedule_series ORDER BY start_date ASC');
  return rows.map(toSeries);
}

async function insertDuty(db: SQLiteDatabase, duty: ScheduledDuty) {
  if (duty.scheduledEnd !== null) {
    const overlap = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM scheduled_duties
       WHERE id != ? AND scheduled_end IS NOT NULL
         AND scheduled_start < ? AND scheduled_end > ? LIMIT 1`,
      duty.id,
      duty.scheduledEnd,
      duty.scheduledStart,
    );
    if (overlap) throw new Error('This schedule overlaps an existing duty.');
  }
  await db.runAsync(
    `INSERT OR IGNORE INTO scheduled_duties (
      id, series_id, occurrence_date, scheduled_start, scheduled_end, timezone,
      break_seconds, rate_override_type, rate_override_minor, status, needs_review, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    duty.id,
    duty.seriesId,
    duty.occurrenceDate,
    duty.scheduledStart,
    duty.scheduledEnd,
    duty.timezone,
    duty.breakSeconds,
    duty.rateOverride?.type ?? null,
    duty.rateOverride?.amountMinor ?? null,
    duty.status,
    duty.needsReview ? 1 : 0,
    duty.note,
    duty.createdAt,
    duty.updatedAt,
  );
}

async function insertSeries(db: SQLiteDatabase, series: ScheduleSeries) {
  await db.runAsync(
    `INSERT INTO schedule_series (
      id, recurrence, start_date, end_date, weekday_mask, start_minutes, end_minutes,
      timezone, break_seconds, rate_override_type, rate_override_minor, note, generated_through, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    series.id,
    series.recurrence,
    series.startDate,
    series.endDate,
    series.weekdayMask.join(','),
    series.startMinutes,
    series.endMinutes,
    series.timezone,
    series.breakSeconds,
    series.rateOverride?.type ?? null,
    series.rateOverride?.amountMinor ?? null,
    series.note,
    series.generatedThrough,
    series.createdAt,
    series.updatedAt,
  );
}

async function materializeSeries(db: SQLiteDatabase, series: ScheduleSeries, windowStart: string, windowEndExclusive: string) {
  const exceptions = await db.getAllAsync<{ occurrence_date: string }>(
    'SELECT occurrence_date FROM schedule_exceptions WHERE series_id = ?',
    series.id,
  );
  const excluded = new Set(exceptions.map((item) => item.occurrence_date));
  for (const duty of generateOccurrences(series, windowStart, windowEndExclusive)) {
    if (!excluded.has(duty.occurrenceDate)) await insertDuty(db, duty);
  }
  const generatedThrough = series.generatedThrough && series.generatedThrough > windowEndExclusive
    ? series.generatedThrough
    : windowEndExclusive;
  await db.runAsync('UPDATE schedule_series SET generated_through = ? WHERE id = ?', generatedThrough, series.id);
}

async function insertException(db: SQLiteDatabase, seriesId: string, occurrenceDate: string, updatedAt: number) {
  await db.runAsync(
    `INSERT INTO schedule_exceptions (series_id, occurrence_date, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(series_id, occurrence_date) DO UPDATE SET updated_at = MAX(updated_at, excluded.updated_at)`,
    seriesId,
    occurrenceDate,
    updatedAt,
    updatedAt,
  );
}

export async function ensureDutyWindow(db: SQLiteDatabase, windowStart: string, windowEndExclusive: string) {
  await runWriteTransaction(db, async (transaction) => {
    const rows = await transaction.getAllAsync<SeriesRow>(
      `SELECT * FROM schedule_series
       WHERE start_date < ? AND (end_date IS NULL OR end_date >= ?)`,
      windowEndExclusive,
      windowStart,
    );
    for (const row of rows) await materializeSeries(transaction, toSeries(row), windowStart, windowEndExclusive);
  });
}

export async function saveSchedule(db: SQLiteDatabase, input: ScheduleInput) {
  await runWriteTransaction(db, async (transaction) => {
    const now = Date.now();
    if (!input.dutyId) {
      const id = `series-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const series = seriesFromInput(input, id, now);
      await insertSeries(transaction, series);
      await materializeSeries(transaction, series, series.startDate, materializationEnd(series));
      return;
    }

    const dutyRow = await transaction.getFirstAsync<DutyRow>('SELECT * FROM scheduled_duties WHERE id = ?', input.dutyId);
    if (!dutyRow) throw new Error('The scheduled duty no longer exists.');
    const duty = toDuty(dutyRow);
    if (input.scope === 'occurrence' || !duty.seriesId) {
      if (duty.seriesId) {
        await insertException(transaction, duty.seriesId, duty.occurrenceDate, now);
      }
      const range = scheduledRange(input.startDate, input.startMinutes, input.endMinutes, input.timezone);
      const replacement: ScheduledDuty = {
        ...duty,
        seriesId: null,
        occurrenceDate: input.startDate,
        scheduledStart: range.start,
        scheduledEnd: range.end,
        timezone: input.timezone,
        breakSeconds: input.breakSeconds,
        rateOverride: input.rateOverride,
        needsReview: false,
        note: input.note.trim(),
        updatedAt: now,
      };
      await insertDuty(transaction, replacement);
      await transaction.runAsync(
        `UPDATE scheduled_duties SET series_id = NULL, occurrence_date = ?, scheduled_start = ?, scheduled_end = ?,
         timezone = ?, break_seconds = ?, rate_override_type = ?, rate_override_minor = ?, needs_review = 0, note = ?, updated_at = ? WHERE id = ?`,
        replacement.occurrenceDate,
        replacement.scheduledStart,
        replacement.scheduledEnd,
        replacement.timezone,
        replacement.breakSeconds,
        replacement.rateOverride?.type ?? null,
        replacement.rateOverride?.amountMinor ?? null,
        replacement.note,
        now,
        duty.id,
      );
      return;
    }

    const oldSeriesRow = await transaction.getFirstAsync<SeriesRow>('SELECT * FROM schedule_series WHERE id = ?', duty.seriesId);
    if (!oldSeriesRow) throw new Error('The recurring schedule no longer exists.');
    const decidedHistory = await transaction.getAllAsync<{ occurrence_date: string }>(
      `SELECT occurrence_date FROM scheduled_duties
       WHERE series_id = ? AND occurrence_date >= ? AND status != 'pending'`,
      duty.seriesId,
      duty.occurrenceDate,
    );
    const preserveSelected = duty.status !== 'pending';
    await transaction.runAsync(
      'UPDATE schedule_series SET end_date = ?, updated_at = ? WHERE id = ?',
      preserveSelected ? duty.occurrenceDate : dayBefore(duty.occurrenceDate),
      now,
      duty.seriesId,
    );
    await deletePendingDuties(transaction, duty.seriesId, duty.occurrenceDate, now);
    const newId = `series-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const newSeries = seriesFromInput({ ...input, startDate: preserveSelected ? dayAfter(duty.occurrenceDate) : input.startDate }, newId, now);
    await insertSeries(transaction, newSeries);
    for (const historicalDuty of decidedHistory) {
      if (historicalDuty.occurrence_date >= newSeries.startDate) {
        await insertException(transaction, newId, historicalDuty.occurrence_date, now);
      }
    }
    await materializeSeries(transaction, newSeries, newSeries.startDate, materializationEnd(newSeries));
  });
}

export async function updateAttendance(db: SQLiteDatabase, dutyId: string, status: AttendanceStatus, now = Date.now()) {
  const duty = await db.getFirstAsync<DutyRow>('SELECT * FROM scheduled_duties WHERE id = ?', dutyId);
  if (!duty) throw new Error('The scheduled duty no longer exists.');
  if (status !== 'pending' && (duty.scheduled_end === null || duty.scheduled_end > now)) {
    throw new Error('Attendance can only be marked after the duty ends.');
  }
  await db.runAsync('UPDATE scheduled_duties SET status = ?, needs_review = 0, updated_at = ? WHERE id = ?', status, now, dutyId);
}

export async function deleteSchedule(db: SQLiteDatabase, dutyId: string, scope: ScheduleEditScope) {
  await runWriteTransaction(db, async (transaction) => {
    const now = Date.now();
    const row = await transaction.getFirstAsync<DutyRow>('SELECT * FROM scheduled_duties WHERE id = ?', dutyId);
    if (!row) return;
    const duty = toDuty(row);
    if (scope === 'future' && duty.seriesId) {
      await transaction.runAsync(
        'UPDATE schedule_series SET end_date = ?, updated_at = ? WHERE id = ?',
        duty.status === 'pending' ? dayBefore(duty.occurrenceDate) : duty.occurrenceDate,
        now,
        duty.seriesId,
      );
      await deletePendingDuties(transaction, duty.seriesId, duty.occurrenceDate, now);
      return;
    }
    if (duty.seriesId) {
      await insertException(transaction, duty.seriesId, duty.occurrenceDate, now);
    }
    await transaction.runAsync('DELETE FROM scheduled_duties WHERE id = ?', duty.id);
    await recordTombstone(transaction, 'duty', duty.id, now);
  });
}

async function recordTombstone(
  db: SQLiteDatabase,
  entityType: 'series' | 'duty' | 'exception',
  entityId: string,
  deletedAt = Date.now(),
) {
  const deviceId = await getOrCreateDeviceId(db);
  await db.runAsync(
    `INSERT INTO sync_tombstones (entity_type, entity_id, deleted_at, device_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(entity_type, entity_id) DO UPDATE SET deleted_at = excluded.deleted_at, device_id = excluded.device_id`,
    entityType,
    entityId,
    deletedAt,
    deviceId,
  );
}

async function deletePendingDuties(db: SQLiteDatabase, seriesId: string, fromDate: string, deletedAt: number) {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM scheduled_duties
     WHERE series_id = ? AND occurrence_date >= ? AND status = 'pending'`,
    seriesId,
    fromDate,
  );
  await db.runAsync(
    `DELETE FROM scheduled_duties
     WHERE series_id = ? AND occurrence_date >= ? AND status = 'pending'`,
    seriesId,
    fromDate,
  );
  for (const row of rows) await recordTombstone(db, 'duty', row.id, deletedAt);
}

function dayAfter(value: string) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + 1);
  return formatLocal(date);
}

function materializationEnd(series: ScheduleSeries) {
  const rollingEnd = nextMaterializationEnd();
  const configuredEnd = series.endDate ? dayAfter(series.endDate) : null;
  return configuredEnd && configuredEnd < rollingEnd ? configuredEnd : rollingEnd;
}

function dayBefore(value: string) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() - 1);
  return formatLocal(date);
}

function formatLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
