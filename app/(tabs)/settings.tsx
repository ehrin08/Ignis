import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, AppText, Screen } from '@/src/components/primitives';
import { SettingsEditor, validateSettings } from '@/src/components/settings-editor';
import { useAppData } from '@/src/providers/app-provider';
import { spacing, useIgnisTheme } from '@/src/theme/tokens';

export default function SettingsScreen() {
  const theme = useIgnisTheme();
  const { settings, saveSettings } = useAppData();
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  async function save() {
    const problem = validateSettings(draft);
    if (problem) return setMessage(problem);
    setSaving(true);
    try {
      await saveSettings({ ...draft, onboardingCompleted: true });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage('Settings saved. Estimates now use these rules.');
    } catch {
      setMessage('Settings could not be saved. Check the schedule and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <AppText variant="title" style={styles.heading}>Settings</AppText>
        <AppText variant="muted">Changes recalculate all estimates, including completed duties.</AppText>
      </View>
      <SettingsEditor onChange={setDraft} value={draft} />
      {message ? <AppText style={{ color: message.startsWith('Settings saved') ? theme.colors.success : theme.colors.danger }}>{message}</AppText> : null}
      <ActionButton label="Save settings" loading={saving} onPress={save} />
      <View style={[styles.disclaimer, { borderColor: theme.colors.outline }]}>
        <AppText variant="label">Estimate, not a payslip</AppText>
        <AppText variant="muted">Ignis calculates gross pay from your entries and rules. It does not include taxes, benefits, bonuses, premiums, deductions, or currency conversion.</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, paddingTop: spacing.md },
  topBar: { minHeight: 76, gap: spacing.xs },
  heading: { fontSize: 30, lineHeight: 36 },
  disclaimer: { borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.sm },
});
