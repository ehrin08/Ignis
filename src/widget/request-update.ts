import { Platform } from 'react-native';

/**
 * Request the Android system to refresh the NextDutyWidget.
 * No-op on non-Android or when the native module is unavailable.
 */
export function requestWidgetRefresh(): void {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget');
    requestWidgetUpdate({ widgetName: 'NextDutyWidget' });
  } catch {
    // Widget module unavailable (Expo Go or web) — silently skip
  }
}
