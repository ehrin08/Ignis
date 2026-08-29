import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Undefined configuration deliberately keeps Ignis usable as a local-only app. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
