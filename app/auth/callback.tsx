import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { supabase } from '@/src/data/supabase';
import { useIgnisTheme } from '@/src/theme/tokens';

/** Completes the PKCE exchange after Supabase redirects web OAuth back to Ignis. */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const theme = useIgnisTheme();

  useEffect(() => {
    async function complete() {
      if (supabase && typeof code === 'string') await supabase.auth.exchangeCodeForSession(code);
      router.replace('/(tabs)/settings');
    }
    complete();
  }, [code]);

  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}><ActivityIndicator color={theme.colors.accent} /></View>;
}
