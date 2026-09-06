import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { useIgnisTheme } from '@/src/theme/tokens';

export default function TabLayout() {
  const theme = useIgnisTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.colors.ink,
      tabBarInactiveTintColor: theme.colors.inkMuted,
      tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.outline, height: 72, paddingTop: 7 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
      tabBarButton: HapticTab,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="schedule" size={size} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="event-note" size={size} /> }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget', tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="account-balance-wallet" size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="tune" size={size} /> }} />
    </Tabs>
  );
}
