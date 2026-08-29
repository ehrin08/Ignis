import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/primitives';
import { useAppData } from '@/src/providers/app-provider';
import { useIgnisTheme } from '@/src/theme/tokens';

export default function EntryScreen() {
  const theme = useIgnisTheme();
  const { loading, error, refresh, settings } = useAppData();
  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator color={theme.colors.accent} size="large" /></View>;
  }
  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <AppText variant="title">The schedule did not open</AppText>
        <AppText variant="muted" style={styles.message}>{error}</AppText>
        <Pressable accessibilityRole="button" onPress={refresh} style={[styles.retry, { backgroundColor: theme.colors.surfaceStrong }]}>
          <AppText variant="label" style={{ color: theme.colors.background }}>Try again</AppText>
        </Pressable>
      </View>
    );
  }
  return <Redirect href={settings.onboardingCompleted ? '/(tabs)' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  message: { textAlign: 'center' },
  retry: { minHeight: 52, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center' },
});
