import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { supabase } from '@/src/data/supabase';
import { useToast } from '@/src/providers/feedback-provider';
import { useIgnisTheme } from '@/src/theme/tokens';

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const theme = useIgnisTheme();
  const { error: showError } = useToast();

  useEffect(() => {
    async function complete() {
      try {
        const callbackError = params.error_description ?? params.error;
        if (callbackError) throw new Error(callbackError);
        if (!supabase) throw new Error('Cloud sync is not configured for this build.');
        if (typeof params.code !== 'string') throw new Error('Google sign-in did not return an authorization code.');
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) throw error;
      } catch (cause) {
        showError(cause instanceof Error ? cause.message : 'Google sign-in could not be completed.', 'Sign-in failed');
      } finally {
        router.replace('/account');
      }
    }
    complete();
  }, [params.code, params.error, params.error_description, showError]);

  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
