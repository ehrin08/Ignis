import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton, AppText, Screen } from '@/src/components/primitives';
import { SettingsEditor, validateSettings } from '@/src/components/settings-editor';
import { useAppData } from '@/src/providers/app-provider';
import { useToast } from '@/src/providers/feedback-provider';
import { spacing, useIgnisTheme } from '@/src/theme/tokens';

export default function SettingsScreen() {
  const theme = useIgnisTheme();
  const { account, settings, saveSettings, syncStatus, lastSyncedAt } = useAppData();
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  async function save() {
    const problem = validateSettings(draft);
    if (problem) {
      toast.error(problem, 'Invalid Settings');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({ ...draft, onboardingCompleted: true });
      toast.success('Settings saved. Estimates now use these rules.', 'Settings Updated');
    } catch {
      toast.error('Settings could not be saved. Check the schedule and try again.');
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
      <ActionButton label="Save settings" loading={saving} onPress={save} />

      <View style={[styles.account, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}>
        <View style={styles.accountCopy}>
          <AppText variant="label">Account & sync</AppText>
          <AppText variant="muted">
            {account
              ? `${account.email ?? account.displayName ?? 'Google account'} · ${syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'error' ? 'Sync needs attention' : lastSyncedAt ? 'Synced' : 'Connected'}`
              : 'Optional Google sign-in keeps your schedule available across devices.'}
          </AppText>
        </View>
        <ActionButton
          icon={account ? 'cloud-done' : 'account-circle'}
          kind="outlined"
          label={account ? 'Manage account' : 'Set up sync'}
          onPress={() => router.push('/account')}
        />
      </View>

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
  account: { borderWidth: 1, borderRadius: 12, padding: spacing.lg, gap: spacing.md },
  accountCopy: { gap: spacing.xs },
});
