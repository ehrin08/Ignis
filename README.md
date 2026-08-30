# Ignis

Ignis is an Android-first, offline schedule, attendance, and estimated gross-pay tracker built with Expo SDK 54, React Native, Expo Router, and TypeScript.

## Run locally

Requires Node.js 20.19 or newer and the Expo Go client compatible with SDK 54.

```bash
npm install
npm start
```

Scan the QR code with Expo Go on Android, or run `npm run android` when an Android emulator is available.

## Build a versioned APK

Install the EAS CLI globally, sign in, and configure Android credentials once. Then run:

```bash
npm run build:apk
```

The production profile increments the remote Android `versionCode`. After EAS finishes, the command downloads the artifact as `dist/Ignis-<appVersion>-build-<versionCode>-release.apk`. The user-facing app version in `app.json` is changed only for deliberate releases.

## Web deployment

The web app is deployed from `master` through Vercel. Vercel runs `npx expo export --platform web` and serves the generated `dist` directory; pull requests receive preview deployments. Vercel also supplies the cross-origin isolation headers required by the Expo SQLite web runtime.

## Optional accounts and sync

Ignis works without an account and always saves to SQLite first. Builds configured with Supabase offer optional Google sign-in, automatic foreground sync, manual retry, and multi-device merging. See [SUPABASE.md](./SUPABASE.md) for the free-project, OAuth, environment, migration, and account-deletion setup.

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
- 100% offline SQLite storage with versioned migrations
- System-controlled light and dark themes

All salary values are estimates of gross pay before taxes, benefits, bonuses, premiums, or deductions. See [PRODUCT.md](./PRODUCT.md) for the full product contract and [DESIGN.md](./DESIGN.md) for the visual system once the finish review is complete.
