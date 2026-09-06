---
name: Ignis
description: A schedule-first Android attendance ledger with a precise clockwork instrument character.
colors:
  light-background: "#EAE8E1"
  light-surface: "#F5F3EC"
  light-surface-raised: "#FEFCF4"
  light-surface-strong: "#20211F"
  light-on-surface-strong: "#F5F3EC"
  light-on-surface-strong-muted: "#D5D3CB"
  light-instrument-line: "#8E8E87"
  light-ink: "#151615"
  light-ink-muted: "#5B5C57"
  light-outline: "#B9B7AE"
  light-outline-strong: "#5E5F5A"
  light-accent: "#D92C25"
  light-on-accent: "#FFFFFF"
  light-success: "#2E7D4D"
  light-danger: "#BA1A1A"
  dark-background: "#0B0B0A"
  dark-surface: "#151614"
  dark-surface-raised: "#1D1E1B"
  dark-surface-strong: "#E9E7DF"
  dark-on-surface-strong: "#151614"
  dark-on-surface-strong-muted: "#454640"
  dark-instrument-line: "#686963"
  dark-ink: "#F1EFE7"
  dark-ink-muted: "#B9B7AF"
  dark-outline: "#454640"
  dark-outline-strong: "#9A9991"
  dark-accent: "#FF5148"
  dark-on-accent: "#220503"
  dark-success: "#72D49A"
  dark-danger: "#FFB4AB"
typography:
  display:
    fontFamily: "Doto_700Bold"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.176
    fontFeature: "tabular-nums"
  display-strong:
    fontFamily: "Doto_800ExtraBold"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.158
    fontFeature: "tabular-nums"
  title:
    fontFamily: "sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.286
    letterSpacing: "-0.35px"
  body:
    fontFamily: "sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.438
  label:
    fontFamily: "sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.286
    letterSpacing: "0.7px"
  muted:
    fontFamily: "sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.429
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  action-button-filled:
    backgroundColor: "{colors.light-surface-strong}"
    textColor: "{colors.light-background}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "52px"
  action-button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.light-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "52px"
  action-button-danger:
    backgroundColor: "{colors.light-danger}"
    textColor: "{colors.light-background}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "52px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.light-ink}"
    size: "48px"
  form-field:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "52px"
  segment-selected:
    backgroundColor: "{colors.light-surface-strong}"
    textColor: "{colors.light-background}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 4px"
    height: "48px"
  weekday-chip-selected:
    backgroundColor: "{colors.light-surface-strong}"
    textColor: "{colors.light-on-surface-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    size: "48px"
  next-duty-instrument:
    backgroundColor: "{colors.light-surface-strong}"
    textColor: "{colors.light-on-surface-strong}"
    rounded: "{rounded.lg}"
    padding: "16px"
    height: "196px"
  duty-row:
    backgroundColor: "transparent"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "76px"
  floating-add-button:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-on-accent}"
    rounded: "{rounded.lg}"
    size: "58px"
  bottom-navigation:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-ink}"
    typography: "{typography.label}"
    height: "72px"
---

# Design System: Ignis

## Overview

**Creative North Star: "Clockwork Ledger"**

Ignis presents the rota as an exposed attendance ledger: scheduled duties sit on a countable rail, the next duty becomes the primary instrument, and earned or projected money stays visibly attached to attendance decisions. The mood is precise, restrained, and operational. Warm paper surfaces, graphite mechanisms, sparse signal red, dot-display numerals, perforations, and ruled rows create character without turning the app into decorative calendar chrome.

The system is native React Native for compact Android phones. Material navigation, date and time pickers, confirmation dialogs, system Back, safe-area insets, scalable type, and 48 dp targets provide the interaction structure. Light and dark schemes follow the device setting. Nothing's clarity, monochrome restraint, and red accents are inspiration only; Ignis does not use Nothing trademarks, logos, proprietary fonts, or assets.

**Key Characteristics:**

- Schedule rails and ruled duty rows make sequence, status, and review work visible.
- A graphite next-duty instrument is the dominant surface for time and rota context.
- Warm paper and graphite tonal layers carry hierarchy; signal red is reserved for selection, review, and the add action.
- Doto is limited to money, times, and the short IGNIS wordmark; sans-serif carries operational reading and controls.
- Explicit labels, icons, outlines, and confirmation states prevent color from carrying meaning alone.

## Colors

The palette maps one warm-paper and graphite system across light and dark themes, with red, green, and danger roles used as sparse operational signals.

### Primary

- **Signal Red:** Marks the floating add action, the current-day or urgent-review rail, count badges, selection, and focus.
- **Dark Signal Red:** Preserves the same semantics in the dark scheme at a higher luminance.

### Secondary

- **Attendance Green:** Marks Completed duty status and its review action.
- **Danger Red:** Marks AWOL status, destructive actions, invalid fields, and error recovery.

### Neutral

- **Warm Field:** Full-screen background and bottom-navigation ground.
- **Ledger Paper:** Tonal fields, total panels, weekday controls, and pressed feedback.
- **Raised Paper:** The lightest hover or raised tonal response without ornamental shadow.
- **Graphite Instrument:** Strong next-duty instrument, filled controls, and selected segments.
- **Instrument Line:** Mid-neutral mechanical detail such as perforations and countable marks.
- **Ink and Muted Ink:** Primary reading and supporting information in each scheme.
- **Outline and Strong Outline:** Hairline grouping, rails, duty shells, and emphasized control boundaries.

### Named Rules

**The Signal Rule.** Red identifies an add action, current or unresolved schedule state, focus, or danger; it never becomes ambient decoration.

**The Role-Mapping Rule.** Components consume semantic theme roles and let Android select the light or dark scheme; native component logic does not hard-code light-theme values.

## Typography

**Display Font:** Doto_700Bold and Doto_800ExtraBold (with monospace only in browser translations)

**Body Font:** Android sans-serif

**Character:** Doto gives time and money a measured dot-matrix voice. The Android system face keeps schedules, forms, status labels, dialogs, and navigation fast to read.

### Hierarchy

- **Display Strong** (800, 38 sp, 44 sp line height): Strong money totals and the IGNIS wordmark; the next-duty time expands locally to 48 sp with a 56 sp line height.
- **Display** (700, 34 sp, 40 sp line height): Measured values such as duty pay; compact row values adapt locally to 19 sp.
- **Title** (700, 21 sp, 27 sp line height): Section names, day groups, form titles, and empty-state headings; screen headings adapt locally to 30 sp.
- **Body** (400, 16 sp, 23 sp line height): Explanations, schedule dates, errors, and field content.
- **Label** (700, 14 sp, 18 sp line height, 0.7 sp tracking, uppercase): Actions, statuses, field names, totals, and navigation; dense duty states adapt locally to 11–12 sp.
- **Muted** (400, 14 sp, 20 sp line height): Period ranges, duty notes, durations, and disclaimers.

### Named Rules

**The Instrument Type Rule.** Use Doto only for money, scheduled-time readouts, and the short IGNIS wordmark; body copy, fields, buttons, and navigation stay sans-serif.

### Brand Mark

Ignis uses an **ember ledger clerk** mascot: a focused signal-red ember carrying a graphite attendance ledger. The approved source artwork lives at `assets/images/mascot-icon.png`; platform exports are regenerated with `scripts/generate-brand-assets.py`. The mascot sits on Warm Field in launcher and web contexts, while Android's monochrome export preserves its compact silhouette for themed icons. It appears on the launcher, splash screen, onboarding, and Today header; it does not replace operational status icons.

**The Scaling Rule.** Display text supports Android font scaling to 1.35× and all other text to 1.6×; paired totals and trailing pay use fit or line limits rather than clipping.

## Layout

Compact Android phones are the V1 canvas. Screens use a 16 dp horizontal inset, 12–16 dp top inset, and the six-step 4/8/12/16/24/32 dp spacing scale. Scroll content reserves 120 dp below its final item so the 58 dp floating add button and 72 dp bottom navigation never obscure evidence or actions.

The Today hierarchy is deliberate: period context, paired earned and projected totals, the strong next-duty instrument, unresolved attendance, then today's duty rail. Schedule groups duties by day on a narrow vertical rail and keeps the completed gross estimate above the list. The editor uses wrapping three-cell date/time rows, full-width fields, 48 dp weekday choices, and native Android pickers. Touch targets are at least 48×48 dp with 8 dp gaps where controls sit together; tablets are outside V1.

## Elevation & Depth

Depth is tonal first. Background, paper surface, raised paper, and graphite create the main hierarchy; 1–1.5 dp outlines, dashed rules, and rail markers establish grouping. The next-duty instrument uses Android elevation 3, while the floating add action uses elevation 5 because it must remain above scrolling content. Routine totals, duty rows, fields, and navigation remain flat.

### Named Rules

**The Instrument-and-Action Elevation Rule.** Elevation belongs only to the next-duty instrument and the floating primary add action; ledger evidence and form surfaces use tone and outline.

## Shapes

The system uses gently curved 8, 12, and 16 dp corners. Twelve dp is the default for actions, fields, totals, and duty shells; 16 dp separates the next-duty instrument; 8 dp tightens segmented selections, weekday choices, and attendance buttons. Circular geometry is reserved for status markers, rail nodes, count badges, and 48 dp icon targets. One-pixel rails, dashed review separators, and five-dp perforations provide countable clockwork detail.

**The Countable Detail Rule.** Express the clockwork metaphor through semantic rails, nodes, perforations, ruled rows, and tabular numerals—not screws, photographic plastic, or raster decoration.

## Components

### Buttons

- **Action Button:** A 52 dp minimum-height, 12 dp-radius Material action with a 1.5 dp boundary, bold uppercase label, optional 20 dp icon, and 8 dp internal gap. Filled actions use graphite, outlined actions remain transparent, and destructive actions use danger red. Pressed opacity is 0.72; disabled opacity is 0.38; loading replaces the contents with an activity indicator.
- **Floating Add Button:** A 58 dp signal-red control with an 18 dp corner treatment, 28 dp add icon, and Android elevation 5. It is anchored 20 dp from the lower-right content edge and always announces “Add a schedule.”
- **Icon Button:** A 48 dp circular outlined target with a 24 dp Material icon, explicit accessibility label, and pressed opacity of 0.62.
- **Attendance Button:** A paired 48 dp outlined action inside Pending duty rows. Green means Complete and danger red means Mark AWOL, but each action also has an icon and label; review remains disabled until the duty has ended.

### Chips

- **Segment:** A 1 dp outlined group with 3 dp inner padding and 12 dp outer corners. Each radio option is at least 48 dp high; the selected option uses graphite inside an 8 dp radius.
- **Weekday Choice:** A 48 dp square checkbox with an 8 dp radius. Selected weekdays use graphite and unselected weekdays use Ledger Paper; accessibility state names both the weekday and selection.

### Cards / Containers

- **Next-Duty Instrument:** A minimum 196 dp graphite surface with 16 dp corners, 16 dp padding, elevation 3, 13 generated perforations, and a 48 sp Doto time. Its empty state preserves the same instrument and says “Schedule clear.”
- **Duty Row:** A 76 dp minimum outlined shell with 12 dp corners. A 16 dp status marker, schedule and note, icon-plus-label status, and optional right-aligned Doto pay share one row. Pending ended duties expose a dashed review tray with paired attendance actions.
- **Schedule Rail:** Twelve- or 14-dp outlined nodes connect with one-dp lines. Signal red marks today or urgent review; the rail organizes evidence rather than decorating it.
- **Estimate and Empty Containers:** The completed-gross panel uses Ledger Paper, a one-dp outline, 12 dp corners, and 16 dp padding. Empty states stay in dashed ledger containers instead of generic cards.

### Inputs / Fields

- **Form Field:** A 52 dp minimum-height tonal field with a one-dp outline, 12 dp radius, 12 dp horizontal inset, 17 sp input text, accent selection, and visible danger copy when invalid.
- **Date Cell:** A 78 dp minimum tonal button with a one-dp outline, 12 dp radius, 12 dp padding, and stacked label/value. Three cells wrap rather than squeeze when space is constrained; Android's native picker owns date and time selection.

### Navigation

The compact-phone navigation bar has four Expo Router destinations—Today, Schedule, Budget, and Settings—on a 72 dp background-toned bar with a top outline. Material icons pair with uppercase 11 sp labels; ink and muted ink distinguish active and inactive states without capsules. The custom tab target provides haptic feedback, and editor screens preserve system Back with an unsaved-change confirmation.

### Budget Ledger

Budget uses a flat Ledger Paper balance panel, a Doto available-balance total, paired funds/expense totals, explicit Add funds and Add expense buttons, and outlined transaction rows ordered newest first. A negative balance has a visible Shortfall label in the danger role. Rows name funds or expense, date, category where relevant, signed amount, and optional description; icons and labels carry meaning alongside color. No salary totals or decorative charts appear here.

Budget entry and category editors reuse Form Field, Action Button, 48 dp category choices, and native Android date pickers. Choices and paired controls wrap on small screens. Empty, loading, save failure, archived-category, and unsaved-change states are explicit. The device-only backup notice appears in Budget and Account & sync.

## Do's and Don'ts

### Do:

- **Do** keep the next duty, unresolved attendance, and traceable earned/projected pay visible in that operational order.
- **Do** use schedule rails, nodes, perforations, dashed review rules, and duty shells as the reusable Clockwork Ledger grammar.
- **Do** preserve Android Material structure, native pickers and dialogs, system Back, safe-area insets, scalable type, screen-reader labels, and 48 dp minimum targets.
- **Do** use semantic light/dark roles and pair every attendance color with a label and icon.
- **Do** keep Doto limited to money, scheduled-time readouts, and the short IGNIS wordmark.

### Don't:

- **Don't** introduce live-clock controls, break controls, or a timer-led hierarchy into this schedule-first product.
- **Don't** turn schedules into a generic calendar-card dashboard or add decorative charts, gradients, glass, or iOS controls.
- **Don't** copy Nothing trademarks, logos, proprietary fonts, or proprietary assets.
- **Don't** use red as ambient decoration or color alone as attendance communication.
- **Don't** add arbitrary shadows to duty rows, totals, fields, or navigation.
