import { ScheduledDuty, ScheduleInput } from '@/src/types';

export const DUTY_DATE_TAKEN_MESSAGE = 'A duty is already scheduled for this date.';

export function blockingDutiesForSchedule(input: ScheduleInput, duties: ScheduledDuty[]) {
  const edited = input.dutyId ? duties.find((duty) => duty.id === input.dutyId) : undefined;
  if (input.scope !== 'future' || !input.seriesId || !edited) return duties;

  return duties.filter((duty) => !(
    duty.seriesId === input.seriesId
    && duty.status === 'pending'
    && duty.occurrenceDate >= edited.occurrenceDate
  ));
}

export function takenDutyDates(input: ScheduleInput, duties: ScheduledDuty[]) {
  const dates = new Set(blockingDutiesForSchedule(input, duties).map((duty) => duty.occurrenceDate));
  const edited = input.dutyId ? duties.find((duty) => duty.id === input.dutyId) : undefined;
  if (edited) dates.delete(edited.occurrenceDate);
  return dates;
}

export function isDutyDateTaken(date: string, duties: ScheduledDuty[], excludedDutyId?: string) {
  return duties.some((duty) => duty.id !== excludedDutyId && duty.occurrenceDate === date);
}
