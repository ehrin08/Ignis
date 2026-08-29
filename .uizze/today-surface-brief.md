# Today surface brief

Mode: Operate. Android phone dashboard at `app/(tabs)/index.tsx`.

The user must be able to read current-period earned/projected gross pay, understand whether a shift or break is active, and clock in/out in one unmistakable action. The approved direction is Clockwork Ledger / Central Dial, seed `1a99c130`, with `.uizze/mocks/clockwork-ledger-a-central-dial.png` as the approved comp.

The first viewport uses compact pay totals above one dominant circular punch clock. A narrow two-row ledger proves how time becomes pay, followed by Android bottom navigation. Warm-white, near-black, graphite, and signal red form the system light scheme; the dark scheme remaps the same roles. Dot-display typography is reserved for timers and money.

Required states: no active shift, running shift, active break, empty ledger, loading, database error, and reduced motion. Maintain 48 dp controls, safe-area insets, screen-reader labels, system Back, and readable large-text behavior.

Do not literalize generated screws, photographic plastic, or rasterized text. Rebuild the dial, ticks, progress arc, perforations, buttons, and ledger structure as responsive semantic React Native views. Reject generic metric-card grids, decorative charts, glass, gradients, and iOS controls.

## Fidelity inventory

| Ingredient | Implementation medium |
| --- | --- |
| Pay-period header and two totals | Semantic text with responsive two-column layout |
| Dominant dial housing | Layered React Native views with circular borders and tonal surfaces |
| Dial ticks and progress arc | React Native views generated from countable tick geometry; no raster |
| Timer and status | Semantic text; Doto display face for timer only |
| Clock and break actions | Accessible Pressable controls with haptics and explicit labels |
| Perforated ledger strip | Semantic rows plus repeated code-drawn circles and dashed rules |
| Bottom navigation | Expo Router tabs using Android-sized targets and vector icons |
| Motion | Reanimated scale/fade feedback, disabled or reduced when the OS requests it |
