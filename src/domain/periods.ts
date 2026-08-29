import { AppSettings, PayPeriod } from '@/src/types';

const DAY_MS = 86_400_000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function monthlyBoundary(year: number, month: number, anchorDay: number) {
  return new Date(year, month, Math.min(anchorDay, daysInMonth(year, month)));
}

export function getPayPeriod(reference: Date, settings: AppSettings, offset = 0): PayPeriod {
  const current = startOfDay(reference);

  if (settings.payCycleType === 'semimonthly') {
    let start: Date;
    let end: Date;
    if (current.getDate() < 16) {
      start = new Date(current.getFullYear(), current.getMonth(), 1);
      end = new Date(current.getFullYear(), current.getMonth(), 16);
    } else {
      start = new Date(current.getFullYear(), current.getMonth(), 16);
      end = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    while (offset > 0) {
      start = end;
      end = start.getDate() === 1
        ? new Date(start.getFullYear(), start.getMonth(), 16)
        : new Date(start.getFullYear(), start.getMonth() + 1, 1);
      offset -= 1;
    }
    while (offset < 0) {
      end = start;
      start = end.getDate() === 16
        ? new Date(end.getFullYear(), end.getMonth(), 1)
        : new Date(end.getFullYear(), end.getMonth() - 1, 16);
      offset += 1;
    }
    return { start, end };
  }

  const anchor = parseLocalDate(settings.payCycleAnchor);
  if (settings.payCycleType === 'monthly') {
    const anchorDay = anchor.getDate();
    let start = monthlyBoundary(current.getFullYear(), current.getMonth(), anchorDay);
    if (current < start) start = monthlyBoundary(current.getFullYear(), current.getMonth() - 1, anchorDay);
    start = monthlyBoundary(start.getFullYear(), start.getMonth() + offset, anchorDay);
    const end = monthlyBoundary(start.getFullYear(), start.getMonth() + 1, anchorDay);
    return { start, end };
  }

  const length = settings.payCycleType === 'biweekly' ? 14 : 7;
  const dayDelta = Math.round((current.getTime() - anchor.getTime()) / DAY_MS);
  const periodIndex = Math.floor(dayDelta / length) + offset;
  const start = addDays(anchor, periodIndex * length);
  return { start, end: addDays(start, length) };
}

export function isInPeriod(timestamp: number, period: PayPeriod) {
  return timestamp >= period.start.getTime() && timestamp < period.end.getTime();
}

export function startOfWeek(date: Date, weekStartsOn: number) {
  const current = startOfDay(date);
  const delta = (current.getDay() - weekStartsOn + 7) % 7;
  return addDays(current, -delta);
}

export { addDays, startOfDay };
