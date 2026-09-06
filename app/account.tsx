import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, AppText, Screen } from '@/src/components/primitives';
import { BUDGET_BACKUP_NOTICE } from '@/src/domain/budget';
import { useAppData } from '@/src/providers/app-provider';
import { useDialog, useToast } from '@/src/providers/feedback-provider';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';

function syncLabel(status: 'local-only' | 'idle' | 'syncing' | 'error') {
  if (status === 'syncing') return 'Syncing now';
  if (status === 'error') return 'Sync needs attention';
  if (status === 'idle') return 'Cloud sync connected';
  return 'Local-only mode';
}

function formatLastSync(value: string | null) {
  if (!value) return 'Not synced yet';
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? 'Not synced yet' : `Last synced ${date.toLocaleString()}`;
}

export default function AccountScreen() {
  const theme = useIgnisTheme();
  const toast = useToast();
  const dialog = useDialog();
  const {
    account,
    cloudConfigured,
    googleSignInAvailable,
    syncStatus,
    lastSyncedAt,
    syncError,
    signInWithGoogle,
    syncNow,
    signOut,
    deleteAccount,
  } = useAppData();
  const [pending, setPending] = useState<'signin' | 'signout' | 'delete' | null>(null);

  async function connectGoogle() {
    setPending('signin');
    try {
      const started = await signInWithGoogle();
      if (!started) toast.info('Google sign-in was cancelled.', 'No changes made');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Google sign-in could not be completed.', 'Sign-in failed');
    } finally {
      setPending(null);
    }
  }

  async function runSync() {
    try {
      await syncNow();
      toast.success('Your schedule is up to date on this device.', 'Sync complete');
    } catch {
      toast.error('Your changes remain saved locally. Try again when the connection is available.', 'Sync failed');
    }
  }

  async function confirmSignOut() {
    const confirmed = await dialog.confirm({
      title: 'Sign out of this device?',
      message: 'The synced schedule cache will be removed from this device. Your cloud copy remains available when you sign in again.',
      confirmText: 'Sign out',
      destructive: true,
    });
    if (!confirmed) return;
    setPending('signout');
    try {
      await signOut();
      router.replace('/onboarding');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Sign-out could not be completed.', 'Sign-out failed');
    } finally {
      setPending(null);
    }
  }

  async function confirmDeleteAccount() {
    const confirmed = await dialog.confirm({
      title: 'Permanently delete account?',
      message: 'This deletes your Ignis account and every synced schedule record. This cannot be undone and does not delete your Google account.',
      confirmText: 'Delete account',
      destructive: true,
    });
    if (!confirmed) return;
    setPending('delete');
    try {
      await deleteAccount();
      router.replace('/onboarding');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The account could not be deleted.', 'Deletion failed');
    } finally {
      setPending(null);
    }
  }

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.heading}>
        <AppText variant="title" style={styles.title}>Account & sync</AppText>
        <AppText variant="muted">Ignis always saves locally first. A Google account adds schedule backup and multi-device sync.</AppText>
        <AppText variant="muted">{BUDGET_BACKUP_NOTICE}. Signing out or deleting your account keeps this device’s budget.</AppText>
      </View>

      {!cloudConfigured ? (
        <View style={[styles.card, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}>
          <MaterialIcons color={theme.colors.inkMuted} name="cloud-off" size={28} />
          <View style={styles.cardCopy}>
            <AppText variant="label">Local-only build</AppText>
            <AppText variant="muted">Supabase public environment variables are not configured. Your schedule remains available on this device.</AppText>
          </View>
        </View>
      ) : null}

      {cloudConfigured && !account ? (
        <View style={[styles.card, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}>
          <MaterialIcons color={theme.colors.accent} name="cloud-sync" size={30} />
          <View style={styles.cardCopy}>
            <AppText variant="label">Optional cloud sync</AppText>
            <AppText>Your existing device schedule will merge safely with the schedule already stored in your account.</AppText>
          </View>
          <ActionButton
            disabled={!googleSignInAvailable}
            icon="account-circle"
            label="Continue with Google"
            loading={pending === 'signin'}
            onPress={connectGoogle}
          />
          {!googleSignInAvailable ? (
            <AppText variant="muted">Google sign-in requires an Android development or installed release build. Expo Go cannot return to Ignis from the secure browser.</AppText>
          ) : null}
        </View>
      ) : null}

      {account ? (
        <>
          <View style={[styles.identity, { borderColor: theme.colors.outlineStrong, backgroundColor: theme.colors.surfaceRaised }]}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceStrong }]}>
              <AppText variant="title" style={{ color: theme.colors.onSurfaceStrong }}>
                {(account.displayName ?? account.email ?? 'G').slice(0, 1).toUpperCase()}
              </AppText>
            </View>
            <View style={styles.identityCopy}>
              <AppText variant="title">{account.displayName ?? 'Google account'}</AppText>
              {account.email ? <AppText variant="muted">{account.email}</AppText> : null}
            </View>
          </View>

          <View style={[styles.card, { borderColor: syncStatus === 'error' ? theme.colors.danger : theme.colors.outline, backgroundColor: theme.colors.surface }]}>
            <View style={styles.statusRow}>
              <MaterialIcons
                color={syncStatus === 'error' ? theme.colors.danger : theme.colors.success}
                name={syncStatus === 'error' ? 'cloud-off' : syncStatus === 'syncing' ? 'sync' : 'cloud-done'}
                size={26}
              />
              <View style={styles.cardCopy}>
                <AppText variant="label">{syncLabel(syncStatus)}</AppText>
                <AppText variant="muted">{formatLastSync(lastSyncedAt)}</AppText>
              </View>
            </View>
            {syncError ? <AppText style={{ color: theme.colors.danger }}>{syncError}</AppText> : null}
            <ActionButton label="Sync now" loading={syncStatus === 'syncing'} onPress={runSync} />
          </View>

          <View style={[styles.actions, { borderColor: theme.colors.outline }]}>
            <ActionButton kind="outlined" label="Sign out of this device" loading={pending === 'signout'} onPress={confirmSignOut} />
            <ActionButton kind="danger" label="Delete account permanently" loading={pending === 'delete'} onPress={confirmDeleteAccount} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, paddingTop: spacing.md },
  heading: { minHeight: 84, gap: spacing.xs },
  title: { fontSize: 30, lineHeight: 36 },
  card: { borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, gap: spacing.md },
  cardCopy: { flex: 1, gap: spacing.xs },
  identity: { borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.md },
});
