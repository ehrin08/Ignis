jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'ignis://auth/callback'),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('expo-linking', () => ({
  parse: jest.fn((url: string) => ({ queryParams: { code: new URL(url).searchParams.get('code') } })),
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('@/src/data/supabase', () => ({
  supabase: { auth: { signInWithOAuth: jest.fn(), exchangeCodeForSession: jest.fn() } },
}));

import * as WebBrowser from 'expo-web-browser';

import { signInWithGoogle } from '@/src/data/oauth';
import { supabase } from '@/src/data/supabase';

const mockSignInWithOAuth = supabase!.auth.signInWithOAuth as jest.Mock;
const mockExchangeCodeForSession = supabase!.auth.exchangeCodeForSession as jest.Mock;
const mockOpenAuthSessionAsync = WebBrowser.openAuthSessionAsync as jest.Mock;

describe('Google OAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/oauth' }, error: null });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  test('exchanges the returned authorization code on native', async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success', url: 'ignis://auth/callback?code=google-code' });

    await expect(signInWithGoogle()).resolves.toBe(true);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'ignis://auth/callback', skipBrowserRedirect: true },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith('https://accounts.google.com/oauth', 'ignis://auth/callback');
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('google-code');
  });

  test('does not exchange a code when the browser is dismissed', async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

    await expect(signInWithGoogle()).resolves.toBe(false);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});
