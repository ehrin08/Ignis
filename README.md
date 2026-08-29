# Ignis

Ignis is an Android-first, offline schedule, attendance, and estimated gross-pay tracker built with Expo SDK 54, React Native, Expo Router, and TypeScript.

## Run locally

Requires Node.js 20.19 or newer and the Expo Go client compatible with SDK 54.

```bash
npm install
npm start
```

Scan the QR code with Expo Go on Android, or run `npm run android` when an Android emulator is available.

Google sign-in requires a development or release build because Expo Go cannot receive the app's custom OAuth redirect. Email/password cloud sync and the rest of Ignis remain usable in Expo Go.

## Web deployment

The web app is deployed from `master` through Vercel. Vercel runs `npx expo export --platform web` and serves the generated `dist` directory; pull requests receive preview deployments. Vercel also supplies the cross-origin isolation headers required by the Expo SQLite web runtime.

Configure these environment variables in Vercel for Production, Preview, and Development:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Use the publishable Supabase key only—never a service-role key. After Vercel assigns the production `*.vercel.app` URL, set it as the Supabase Auth Site URL and allow `<production-url>/auth/callback` plus the Vercel preview callback pattern. See [SUPABASE.md](./SUPABASE.md) for the complete Supabase setup.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

## Product scope

- One-off, daily, and selected-weekday recurring schedules
- Pending, Completed, and AWOL attendance with confirmed corrections
- Editable overnight duties and configurable unpaid breaks
- Weekly, biweekly, semi-monthly, and monthly pay periods
- Daily or weekly overtime estimates
- Future-schedule projection with overdue attendance review
- Offline SQLite storage with versioned migrations
- System-controlled light and dark themes

All salary values are estimates of gross pay before taxes, benefits, bonuses, premiums, or deductions. See [PRODUCT.md](./PRODUCT.md) for the full product contract and [DESIGN.md](./DESIGN.md) for the visual system once the finish review is complete.
