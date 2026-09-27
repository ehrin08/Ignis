
export const CHANNEL_DUTY = 'duty-reminders';
export const CHANNEL_ATTENDANCE = 'attendance-review';
export const CHANNEL_SUMMARY = 'daily-summary';

export const NOTIFICATION_CHANNELS = [
  {
    id: CHANNEL_DUTY,
    name: 'Duty Reminders',
    importance: 5, // AndroidImportance.HIGH
    description: 'Alerts before your scheduled shifts',
    lightColor: '#D92C25',
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: CHANNEL_ATTENDANCE,
    name: 'Attendance Review',
    importance: 4, // AndroidImportance.DEFAULT
    description: 'Reminders to mark completed duties',
  },
  {
    id: CHANNEL_SUMMARY,
    name: 'Daily Summary',
    importance: 3, // AndroidImportance.LOW
    description: 'Morning schedule overview',
  },
] as const;
