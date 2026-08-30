import { makeRedirectUri } from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/src/data/supabase';

WebBrowser.maybeCompleteAuthSession();

export const isGoogleSignInAvailable = Platform.OS === 'web'
  || Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export function getAuthRedirectUri() {
  return makeRedirectUri({ scheme: 'ignis', path: 'auth/callback' });
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Cloud sync is not configured for this build.');
  if (!isGoogleSignInAvailable) {
    throw new Error('Google sign-in requires a development or installed release build and is not available in Expo Go.');
  }

  const redirectTo = getAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });
  if (error) throw error;

  if (Platform.OS === 'web') return true;
  if (!data.url) throw new Error('Google sign-in could not be started.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const query = Linking.parse(result.url).queryParams;
  const oauthError = query?.error_description ?? query?.error;
  if (typeof oauthError === 'string') throw new Error(oauthError);
  const code = query?.code;
  if (typeof code !== 'string') throw new Error('Google sign-in did not return an authorization code.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}
