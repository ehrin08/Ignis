import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ActionButton, AppText, Screen } from '@/src/components/primitives';
import { SettingsEditor, validateSettings } from '@/src/components/settings-editor';
import { useAppData } from '@/src/providers/app-provider';
import { spacing, useIgnisTheme } from '@/src/theme/tokens';

export default function SettingsScreen() {
  const theme = useIgnisTheme();
  const { settings, saveSettings, cloudConfigured, session, syncing, lastSyncedAt, googleSignInAvailable, signInWithGoogle, signInWithPassword, signOut, signUpWithPassword, syncNow } = useAppData();
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authPending, setAuthPending] = useState(false);

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

  async function signIn() {
    if (!email.includes('@') || !password) return setMessage('Enter a valid email address and password.');
    setAuthPending(true);
    try {
      await signInWithPassword(email, password);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Sign-in could not be completed.');
    } finally {
      setAuthPending(false);
    }
  }

  async function signInGoogle() {
    setAuthPending(true);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Google sign-in could not be completed.');
    } finally {
      setAuthPending(false);
    }
  }

  async function signUp() {
    if (!email.includes('@') || password.length < 6) return setMessage('Enter a valid email address and a password of at least 6 characters.');
    setAuthPending(true);
    try {
      const confirmationRequired = await signUpWithPassword(email, password);
      setMessage(confirmationRequired ? 'Check your email to confirm your account, then sign in.' : 'Account created and cloud sync connected.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Account creation could not be completed.');
    } finally {
      setAuthPending(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out of cloud sync?', 'This removes the synced schedule cache from this device. Your cloud data remains safe in your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut().catch(() => setMessage('Could not sign out of cloud sync.')) },
    ]);
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
      <View style={[styles.account, { borderColor: theme.colors.outline }]}>
        <AppText variant="label">Cloud sync</AppText>
        {!cloudConfigured ? <AppText variant="muted">Cloud sync is unavailable in this build. Add the Supabase public environment variables to enable it.</AppText> : null}
        {cloudConfigured && !session ? <>
          <AppText variant="muted">Create an account or sign in to securely back up this device’s schedule and keep it in sync across devices.</AppText>
          <ActionButton
            disabled={!googleSignInAvailable}
            icon="account-circle"
            kind="outlined"
            label="Continue with Google"
            loading={authPending}
            onPress={signInGoogle}
          />
          {!googleSignInAvailable ? <AppText variant="muted">Google sign-in requires a development or release build. Expo Go cannot return from the secure browser to Ignis.</AppText> : null}
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={theme.colors.inkMuted}
            style={[styles.authInput, { borderColor: theme.colors.outline, color: theme.colors.ink }]}
            value={email}
          />
          <TextInput
            autoComplete="current-password"
            onChangeText={setPassword}
            placeholder="Password (6+ characters)"
            placeholderTextColor={theme.colors.inkMuted}
            secureTextEntry
            style={[styles.authInput, { borderColor: theme.colors.outline, color: theme.colors.ink }]}
            value={password}
          />
          <ActionButton label="Sign in" loading={authPending} onPress={signIn} />
          <ActionButton label="Create account" loading={authPending} onPress={signUp} />
        </> : null}
        {cloudConfigured && session ? <>
          <AppText variant="muted">Connected as {session.user.email ?? 'Google account'}{lastSyncedAt ? ` · Last synced ${new Date(Number(lastSyncedAt)).toLocaleString()}` : ''}</AppText>
          <ActionButton label="Sync now" loading={syncing} onPress={() => syncNow().catch(() => undefined)} />
          <ActionButton label="Sign out and remove this device cache" onPress={confirmSignOut} />
        </> : null}
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
  account: { borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.sm },
  authInput: { borderWidth: 1, borderRadius: 10, minHeight: 48, paddingHorizontal: spacing.md },
});
