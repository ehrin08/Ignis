import { generateOccurrences, nextMaterializationEnd, parseLocalDate, scheduledRange, seriesFromInput } from '@/src/domain/schedule';
import { ScheduledDuty, ScheduleInput } from '@/src/types';

function isValidLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = parseLocalDate(value);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function dutiesOverlap(start: number, end: number, existing: ScheduledDuty[], excludedId?: string) {
  return existing.some((duty) => {
    if (duty.id === excludedId || duty.scheduledEnd === null) return false;
    return start < duty.scheduledEnd && end > duty.scheduledStart;
  });
}

export function validateScheduleInput(input: ScheduleInput, existing: ScheduledDuty[]) {
  if (!isValidLocalDate(input.startDate)) return 'Enter a valid start date.';
  if (input.endDate && !isValidLocalDate(input.endDate)) return 'Enter a valid repeat end date.';
  if (input.endDate && input.endDate < input.startDate) return 'Repeat end date cannot be before the start date.';
  if (!Number.isFinite(input.startMinutes) || !Number.isFinite(input.endMinutes) || input.startMinutes < 0 || input.startMinutes > 1439 || input.endMinutes < 0 || input.endMinutes > 1439) return 'Choose valid start and end times.';
  if (input.startMinutes === input.endMinutes) return 'Start and end time cannot be the same.';
  if (input.recurrence === 'weekly' && input.weekdayMask.length === 0) return 'Choose at least one weekday.';
  const range = scheduledRange(input.startDate, input.startMinutes, input.endMinutes, input.timezone);
  const durationSeconds = Math.floor((range.end - range.start) / 1000);
  if (!Number.isFinite(input.breakSeconds)) return 'Unpaid break must be a number of minutes.';
  if (input.breakSeconds < 0) return 'Unpaid break cannot be negative.';
  if (input.breakSeconds >= durationSeconds) return 'Unpaid break must be shorter than the duty.';
  if (input.rateOverride !== null) {
    if (input.rateOverride.type !== 'hourly' && input.rateOverride.type !== 'day') return 'Choose a valid rate override type.';
    if (!Number.isInteger(input.rateOverride.amountMinor) || input.rateOverride.amountMinor <= 0) return 'Rate override must be greater than zero.';
  }

  const requestedPreviewEnd = input.endDate ? localTomorrow(input.endDate) : localTomorrow(input.startDate);
  const previewEnd = requestedPreviewEnd < nextMaterializationEnd() ? requestedPreviewEnd : nextMaterializationEnd();
  const preview = generateOccurrences(seriesFromInput(input, 'validation'), input.startDate, previewEnd);
  for (const duty of preview) {
    if (duty.scheduledEnd && dutiesOverlap(duty.scheduledStart, duty.scheduledEnd, existing, input.dutyId)) {
      return 'This schedule overlaps an existing duty.';
    }
  }
  return null;
}

function localTomorrow(value: string) {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
