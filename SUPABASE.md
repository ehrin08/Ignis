# Supabase account and sync setup

Ignis remains fully usable without Supabase. These steps enable optional Google accounts and multi-device sync using Supabase's free plan.

## 1. Create and migrate the project

1. Create a Supabase Free project.
2. Run `supabase/migrations/202608300001_ignis_accounts_sync.sql` in the SQL editor, or link the Supabase CLI and run `supabase db push`.
3. Deploy account deletion with `supabase functions deploy delete-account`.

The client uses only the project URL and publishable key. The delete function receives Supabase's server-side service-role secret automatically; never copy that secret into Expo, EAS, Vercel, or a client environment file.

## 2. Configure Google

1. In Google Auth Platform, create a **Web application** OAuth client.
2. Add the callback URL shown on Supabase's Google provider page, normally `https://<project-ref>.supabase.co/auth/v1/callback`, to Google's authorized redirect URIs.
3. Enable Google under Supabase **Authentication → Providers** and enter the Google client ID and client secret.
4. Under Supabase **Authentication → URL Configuration**, allow:
   - `ignis://auth/callback`
   - the local Expo web callback URL used during development
   - `https://<production-domain>/auth/callback`
5. Set the production web origin as the Supabase Site URL.

Google sign-in works on web and installed Android development/release builds. Expo Go cannot complete the custom-scheme return, so use `npm run android` or an installed APK for Android authentication testing.

## 3. Configure the app

Copy `.env.example` to `.env.local` and fill in the public values from the Supabase Connect panel:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Add the same variables to the production and preview environments in Vercel and to the relevant EAS build profiles. Builds without both variables stay in local-only mode.

## 4. Verify

1. Create a local schedule while signed out.
2. Sign in with Google and confirm the first sync completes.
3. Sign in on a second device or web browser and verify the schedule appears.
4. Make conflicting edits and deletions, then bring both clients to the foreground and confirm the newest record or tombstone wins.
5. Sign out and confirm the local synced cache is removed while signing back in restores the cloud copy.
6. Delete the account and confirm the Supabase Auth user and `ignis_records` rows are removed.

Free projects can pause after inactivity. During a pause, Ignis continues saving locally and reports that sync needs attention until the project is available again.
