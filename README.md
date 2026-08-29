# Ignis

Ignis is an Android-first, offline schedule, attendance, and estimated gross-pay tracker built with Expo SDK 54, React Native, Expo Router, and TypeScript.

## Run locally

Requires Node.js 20.19 or newer and the Expo Go client compatible with SDK 54.

```bash
npm install
npm start
```

Scan the QR code with Expo Go on Android, or run `npm run android` when an Android emulator is available.

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
