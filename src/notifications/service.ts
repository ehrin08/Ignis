import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';

function getNotifications(): typeof ExpoNotifications | null {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

import type { AppSettings, ScheduledDuty } from '@/src/types';
import { NOTIFICATION_CHANNELS } from './channels';
import { computeAllNotifications } from './scheduler';

/** Create Android notification channels (idempotent). */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = getNotifications();
  if (!Notifications) return;

  for (const channel of NOTIFICATION_CHANNELS) {
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      importance: channel.importance,
      description: channel.description,
      ...('lightColor' in channel ? { lightColor: channel.lightColor } : {}),
      ...('vibrationPattern' in channel ? { vibrationPattern: [...channel.vibrationPattern] } : {}),
    });
  }
}

/** Request POST_NOTIFICATIONS permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const response = await Notifications.getPermissionsAsync() as any;
  if (response.granted || response.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync() as any;
  return requested.granted || requested.status === 'granted';
}

/** Check whether notification permission is currently granted. */
export async function hasNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const response = await Notifications.getPermissionsAsync() as any;
  return response.granted || response.status === 'granted';
}

/**
 * Cancel all scheduled notifications and re-schedule from current data.
 * This is the main entry point called after every data mutation.
 */
export async function rescheduleAllNotifications(
  duties: ScheduledDuty[],
  settings: AppSettings,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = getNotifications();
  if (!Notifications) return;

  // Check permission without requesting — if denied, skip silently
  const granted = await hasNotificationPermission();
  if (!granted) return;

  // Ensure channels exist
  await ensureNotificationChannels();

  // Cancel all previously scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Compute and schedule new notifications
  const descriptors = computeAllNotifications(duties, settings);

  for (const descriptor of descriptors) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: descriptor.identifier,
        content: {
          title: descriptor.title,
          body: descriptor.body,
          data: descriptor.data ?? {},
          ...(Platform.OS === 'android' ? { channelId: descriptor.channelId } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: descriptor.triggerDate,
        },
      });
    } catch {
      // Individual notification failures are non-critical — skip silently
    }
  }
}
