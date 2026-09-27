import { AndroidImportance } from 'expo-notifications';

export const CHANNEL_DUTY = 'duty-reminders';
export const CHANNEL_ATTENDANCE = 'attendance-review';
export const CHANNEL_SUMMARY = 'daily-summary';

export const NOTIFICATION_CHANNELS = [
  {
    id: CHANNEL_DUTY,
    name: 'Duty Reminders',
    importance: AndroidImportance.HIGH,
    description: 'Alerts before your scheduled shifts',
    lightColor: '#D92C25',
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: CHANNEL_ATTENDANCE,
    name: 'Attendance Review',
    importance: AndroidImportance.DEFAULT,
    description: 'Reminders to mark completed duties',
  },
  {
    id: CHANNEL_SUMMARY,
    name: 'Daily Summary',
    importance: AndroidImportance.LOW,
    description: 'Morning schedule overview',
  },
] as const;
