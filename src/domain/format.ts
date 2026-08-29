export function formatCurrency(minor: number, currencyCode: string, locale?: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${currencyCode} ${(minor / 100).toFixed(2)}`;
  }
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatPeriodRange(start: Date, end: Date, locale?: string) {
  const inclusiveEnd = new Date(end.getTime() - 1);
  const sameMonth = start.getMonth() === inclusiveEnd.getMonth() && start.getFullYear() === inclusiveEnd.getFullYear();
  const startText = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: start.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(start);
  const endText = new Intl.DateTimeFormat(locale, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: inclusiveEnd.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(inclusiveEnd);
  return `${startText}—${endText}`.toUpperCase();
}
