# Supabase setup

1. Create a Supabase project and run `supabase/migrations/202608290001_ignis_sync.sql` in its SQL editor (or through the Supabase CLI).
2. Copy `.env.example` to `.env` and fill in the project URL and **publishable** key from the project Connect panel. Do not add a service-role key to an Expo app.
3. In Supabase Auth, ensure the Email provider is enabled. Confirm-email can remain enabled; the app will prompt the new user to verify their email before signing in.
4. In Google Auth Platform, create a Web application OAuth client. Add the Supabase callback URL shown on the Google provider page (normally `https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI.
5. Enable the Google provider in Supabase Auth and enter that Google client ID and client secret.
6. In Supabase Auth URL configuration, allow `ignis://auth/callback`, the local Expo web callback URL, and the production web callback URL. Set the production web origin as Site URL.

The app is intentionally usable without this configuration. Email/password authentication works on Android and web without a native sign-in module. Google authentication works on web and in development or release builds; Expo Go cannot complete OAuth redirects to the custom `ignis` scheme. Use `npm run android` or an installed release APK when testing Google sign-in. Once configured, an existing local schedule is imported on first sign-in. Sign-out clears the synced account cache only from that device.
