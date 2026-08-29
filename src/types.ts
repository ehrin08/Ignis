export type PayCycleType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type OvertimeMode = 'none' | 'daily' | 'weekly';
export type RecurrenceType = 'once' | 'daily' | 'weekly';
export type AttendanceStatus = 'pending' | 'completed' | 'awol';
export type ScheduleEditScope = 'occurrence' | 'future';

export type AppSettings = {
  onboardingCompleted: boolean;
  currencyCode: string;
  hourlyRateMinor: number;
  payCycleType: PayCycleType;
  payCycleAnchor: string;
  overtimeMode: OvertimeMode;
  overtimeThresholdMinutes: number;
  overtimeMultiplierBps: number;
  weekStartsOn: number;
};

export type ScheduleSeries = {
  id: string;
  recurrence: RecurrenceType;
  startDate: string;
  endDate: string | null;
  weekdayMask: number[];
  startMinutes: number;
  endMinutes: number;
  timezone: string;
  breakSeconds: number;
  note: string;
  generatedThrough: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ScheduledDuty = {
  id: string;
  seriesId: string | null;
  occurrenceDate: string;
  scheduledStart: number;
  scheduledEnd: number | null;
  timezone: string;
  breakSeconds: number;
  status: AttendanceStatus;
  needsReview: boolean;
  note: string;
  createdAt: number;
  updatedAt: number;
};

export type PayPeriod = {
  start: Date;
  end: Date;
};

export type PayBreakdown = {
  paidSeconds: number;
  regularSeconds: number;
  overtimeSeconds: number;
  grossMinor: number;
};

export type DashboardSummary = {
  earned: PayBreakdown;
  projected: PayBreakdown;
  overdueCount: number;
};

export type ScheduleInput = {
  dutyId?: string;
  seriesId?: string | null;
  scope: ScheduleEditScope;
  recurrence: RecurrenceType;
  startDate: string;
  endDate: string | null;
  weekdayMask: number[];
  startMinutes: number;
  endMinutes: number;
  timezone: string;
  breakSeconds: number;
  note: string;
};
