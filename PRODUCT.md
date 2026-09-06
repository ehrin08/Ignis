# Product

<!-- uizze:product-schema 1 -->

## Platform

android

## Stack

React Native with TypeScript, Expo Go SDK 54, Expo Router, and Expo SQLite.

## Users

Ignis is a private, single-user tool for an hourly worker who receives a rota and wants a clear record of scheduled duties, attendance, and estimated gross earnings without relying on an employer portal.

## Product Purpose

Ignis turns one-off or recurring schedules into an attendance ledger. The user marks ended duties Completed or AWOL, and Ignis keeps earned and projected gross pay traceable to those scheduled hours and the current pay rules.

## Positioning

Ignis is a schedule-first attendance ledger: the rota, attendance decision, overtime split, earned pay, and forward estimate remain connected rather than living in separate calendar and payroll views.

## Operating Context

- The app is used on an Android phone before or after work to enter schedules and review attendance.
- Duties may recur daily or on selected weekdays and may run overnight.
- Attendance is a deliberate manual decision after a duty ends; Ignis never automatically labels someone AWOL.
- Pay is reviewed by weekly, biweekly, semi-monthly, or monthly period.

## Capabilities and Constraints

- Offline-first local storage remains fully usable without an account; optional Google accounts add private Supabase backup and multi-device sync, with no notifications or team features.
- One-off, daily, and selected-weekday recurring schedules with optional end dates.
- Pending, Completed, and AWOL duty states; corrections require confirmation.
- Scheduled duration minus unpaid break is authoritative; there is no live clock or partial-attendance model.
- Completed duties earn estimated gross pay, future Pending duties project pay, and AWOL or overdue Pending duties contribute zero.
- Configurable currency, hourly rate, pay cycle, and one daily or weekly overtime rule.
- Existing clock-recorded shifts migrate without destructive reset.
- Estimates exclude taxes, benefits, bonuses, premiums, and deductions.
- V1 recalculates estimates from current pay settings and does not maintain payroll-grade rate history or exchange currencies.
- English UI with device-locale date, time, and monetary formatting.
- Android phones are the V1 acceptance target; tablets and iOS are not.

## Personal Budget Extension

- A separate Budget tab tracks one running balance in PHP, starting at zero with no monthly reset.
- Funds and actual expenses are entered manually with a positive amount, today or a past date, and an optional description. Expenses have an editable category.
- Available balance is funds added minus expenses. Overspending is allowed and explicitly labeled Shortfall.
- Entries can be edited or deleted with deletion confirmation; totals update after a successful local save.
- Food, Transport, Bills, Shopping, Health, Entertainment, and Other are initial categories. Categories can be added, renamed, archived, and restored. Renaming applies to historical labels; archiving preserves history and excludes the category from new expenses.
- Budget currency and funds are independent of salary settings, attendance, and pay estimates. There are no automatic transfers, recurring expenses, multiple wallets, or category limits.
- Budget is stored on this device and is not included in account backup. Signing in, signing out, switching accounts, or deleting an account preserves this device's budget. Uninstalling or clearing app storage removes local budget data.
- Amounts use integer centavos; decimal input accepts at most two decimal places. Invalid, future-dated, or numerically unsafe entries cannot be saved.

## Brand Commitments

- Product name: Ignis.
- The interface is inspired by Nothing's clarity, monochrome restraint, red status accents, and dot-display character, without copying Nothing trademarks, logos, proprietary fonts, or assets.
- The approved product metaphor remains “Clockwork Ledger,” now expressed as a precise schedule rail and exposed attendance ledger rather than a punch-clock control.
- The branded light and dark schemes follow the Android system setting.

## Evidence on Hand

No customer claims, employer records, payroll integrations, or employer visual assets are available. Development examples must not fabricate payroll accuracy or employer endorsement.

## Product Principles

- Make the next duty and unresolved attendance visible within seconds.
- Keep every estimate traceable to scheduled time, attendance status, and visible pay rules.
- Preserve completed history when recurring schedules change.
- Express the brand through precise operational details, not decorative calendar chrome.
- Treat accessibility and Android conventions as part of trust.

## Accessibility & Inclusion

Support Android font scaling, 48 dp minimum touch targets, system light/dark mode, reduced motion, screen-reader labels, edge-to-edge insets, non-color attendance labels, and system Back recovery for unsaved edits.
