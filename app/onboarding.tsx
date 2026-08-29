import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/src/components/brand-mark';
import { ActionButton, AppText, Screen } from '@/src/components/primitives';
import { SettingsEditor, validateSettings } from '@/src/components/settings-editor';
import { useAppData } from '@/src/providers/app-provider';
import { spacing, useIgnisTheme } from '@/src/theme/tokens';

export default function OnboardingScreen() {
  const theme = useIgnisTheme();
  const { settings, saveSettings } = useAppData();
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function complete() {
    const problem = validateSettings(draft);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await saveSettings({ ...draft, onboardingCompleted: true });
      router.replace('/(tabs)');
    } catch {
      setError('Your setup could not be saved. Check the values and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <BrandMark size={56} />
        <AppText variant="displayStrong" style={styles.brand}>IGNIS</AppText>
        <AppText variant="title">Set the rules once. See every estimate clearly.</AppText>
        <AppText variant="muted">Ignis keeps your schedules and attendance on this device and estimates gross pay before taxes or deductions.</AppText>
      </View>
      <SettingsEditor onChange={setDraft} value={draft} />
      {error ? <AppText style={{ color: theme.colors.danger, marginTop: spacing.lg }}>{error}</AppText> : null}
      <ActionButton label="Open my schedule" loading={saving} onPress={complete} style={styles.finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 34, gap: 12 },
  brand: { fontSize: 44 },
  finish: { marginTop: 32 },
});
