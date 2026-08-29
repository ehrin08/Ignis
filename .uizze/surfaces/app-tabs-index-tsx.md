---
version: 1
slug: "app-tabs-index-tsx"
primary_target: "app/(tabs)/index.tsx"
related_targets:
  - "app/(tabs)/schedule.tsx"
  - "app/schedule/[id].tsx"
---

# Today schedule surface brief

Mode: Operate. Android phone schedule and attendance dashboard.

The user must be able to read current-period earned/projected gross pay, find the next duty, resolve overdue Pending attendance, and scan today's remaining or decided duties. The approved visual world remains Clockwork Ledger, seed `1a99c130`; the former punch dial is intentionally retired because scheduled time is now authoritative.

The first viewport uses compact paired pay totals above one graphite next-duty instrument. Below it, a perforated schedule rail and semantic duty rows expose Pending, Completed, and AWOL states. Warm-white, near-black, graphite, and signal red form the light scheme; the dark scheme remaps the same roles. Doto is reserved for money and the next-duty time.

Required states: no schedule, future Pending, overdue Pending, Completed, AWOL, migrated missing-end review, loading, database error with retry, disabled status actions before duty end, save/delete failure, unsaved edit recovery, light/dark mode, large text, and reduced motion.

Maintain 48 dp controls, safe-area insets, screen-reader labels, system Back, and non-color status labels. Build agenda rails, perforations, markers, and badges as responsive semantic React Native views. Reject generic metric-card grids, decorative charts, photographic hardware, glass, gradients, and iOS controls.

## Fidelity inventory

| Ingredient | Implementation medium |
| --- | --- |
| Pay-period header and paired totals | Semantic text with responsive two-column layout |
| Next-duty instrument | Strong tonal React Native surface with generated perforations |
| Schedule rail and date groups | React Native lines, markers, and semantic headings |
| Attendance state | Material vector icon, marker geometry, and explicit text label |
| Review actions | Accessible 48 dp Pressables with confirmation and haptics |
| Duty pay and times | Semantic text; Doto only for numeric instrument values |
| Add schedule action | Single Material-style FAB |
| Bottom navigation | Expo Router tabs using Android-sized targets and Material icons |
