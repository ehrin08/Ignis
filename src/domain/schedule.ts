import { localDateKey } from '@/src/domain/format';
import { ScheduledDuty, ScheduleInput, ScheduleSeries } from '@/src/types';

export const MATERIALIZATION_DAYS = 90;

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addCalendarDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function dateAtMinutes(dateValue: string, minutes: number) {
  const date = parseLocalDate(dateValue);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function wallClockParts(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function timeZoneOffset(timestamp: number, timeZone: string) {
  const parts = wallClockParts(timestamp, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - timestamp;
}

export function wallClockDate(timestamp: number, timeZone: string) {
  const parts = wallClockParts(timestamp, timeZone);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function zonedTimestamp(dateValue: string, minutes: number, timeZone: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  let timestamp = wallClock - timeZoneOffset(wallClock, timeZone);
  timestamp = wallClock - timeZoneOffset(timestamp, timeZone);
  return timestamp;
}

export function scheduledRange(dateValue: string, startMinutes: number, endMinutes: number, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const start = zonedTimestamp(dateValue, startMinutes, timeZone);
  const endDate = endMinutes <= startMinutes ? localDateKey(addCalendarDays(parseLocalDate(dateValue), 1)) : dateValue;
  const end = zonedTimestamp(endDate, endMinutes, timeZone);
  return { start, end };
}

export function shouldOccur(series: Pick<ScheduleSeries, 'recurrence' | 'startDate' | 'weekdayMask'>, date: Date) {
  const key = localDateKey(date);
  if (key < series.startDate) return false;
  if (series.recurrence === 'once') return key === series.startDate;
  if (series.recurrence === 'daily') return true;
  return series.weekdayMask.includes(date.getDay());
}

export function generateOccurrences(series: ScheduleSeries, windowStart: string, windowEndExclusive: string): ScheduledDuty[] {
  const duties: ScheduledDuty[] = [];
  let cursor = parseLocalDate(windowStart < series.startDate ? series.startDate : windowStart);
  const windowEnd = parseLocalDate(windowEndExclusive);
  while (cursor < windowEnd) {
    const occurrenceDate = localDateKey(cursor);
    if (series.endDate && occurrenceDate > series.endDate) break;
    if (shouldOccur(series, cursor)) {
      const range = scheduledRange(occurrenceDate, series.startMinutes, series.endMinutes, series.timezone);
      duties.push({
        id: `${series.id}:${occurrenceDate}`,
        seriesId: series.id,
        occurrenceDate,
        scheduledStart: range.start,
        scheduledEnd: range.end,
        timezone: series.timezone,
        breakSeconds: series.breakSeconds,
        rateOverride: series.rateOverride,
        status: 'pending',
        needsReview: false,
        note: series.note,
        createdAt: series.createdAt,
        updatedAt: series.updatedAt,
      });
    }
    if (series.recurrence === 'once') break;
    cursor = addCalendarDays(cursor, 1);
  }
  return duties;
}

export function seriesFromInput(input: ScheduleInput, id: string, createdAt = Date.now()): ScheduleSeries {
  return {
    id,
    recurrence: input.recurrence,
    startDate: input.startDate,
    endDate: input.recurrence === 'once' ? input.startDate : input.endDate,
    weekdayMask: input.recurrence === 'weekly' ? input.weekdayMask : [],
    startMinutes: input.startMinutes,
    endMinutes: input.endMinutes,
    timezone: input.timezone,
    breakSeconds: input.breakSeconds,
    rateOverride: input.rateOverride,
    note: input.note.trim(),
    generatedThrough: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function nextMaterializationEnd(reference = new Date()) {
  return localDateKey(addCalendarDays(reference, MATERIALIZATION_DAYS + 1));
}

export function materializationEnd(series: Pick<ScheduleSeries, 'startDate' | 'endDate'>, reference = new Date()) {
  const firstOccurrenceEnd = localDateKey(addCalendarDays(parseLocalDate(series.startDate), 1));
  const rollingEnd = nextMaterializationEnd(reference);
  const effectiveHorizon = rollingEnd > firstOccurrenceEnd ? rollingEnd : firstOccurrenceEnd;
  const configuredEnd = series.endDate
    ? localDateKey(addCalendarDays(parseLocalDate(series.endDate), 1))
    : null;
  return configuredEnd && configuredEnd < effectiveHorizon ? configuredEnd : effectiveHorizon;
}
