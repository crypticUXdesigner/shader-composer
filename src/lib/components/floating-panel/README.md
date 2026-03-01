# Floating panels

Generic and concrete floating-panel implementations. **If a Svelte component is only used by a floating panel, it lives here.**

## Layout

| File | Role |
|------|------|
| **FloatingPanel.svelte** | Generic chrome: header (left slot + drag handle + close), content slot, optional footer. Used by concrete panels. |
| **floatingPanelPosition.ts** | Shared persistence: `getStoredPosition` / `setStoredPosition` for per-panel (and per-variant) coordinates. |
| **AudioSignalPicker.svelte** | Public entry for the audio signal picker. Forwards to `AudioSignalPickerPanel`. |
| **AudioSignalPickerPanel.svelte** | Concrete panel: composes `FloatingPanel` + audio large/compact content and sizing. |
| **AudioSignalPickerLargeContent.svelte** | Content for “no connection” mode: bands list + remappers. Used only by `AudioSignalPickerPanel`. |
| **AudioSignalPickerCompact.svelte** | Content for “audio connected” mode: band/remapper config + Disconnect. Used only by `AudioSignalPickerPanel`. |
| **AudioSignalPicker.types.ts** | Slot contracts: `LargeSlotProps`, `CompactSlotProps`. |

## Usage

- **App / overlay bridge**: import `AudioSignalPicker` from `@/lib/components` (re-exported from this folder).
- **Position persistence**: use `getStoredPosition` / `setStoredPosition` from this folder when opening a panel and in `onPositionChange`.

## Dependencies

- Large/compact content components import shared **audio widgets** from `../audio/` (e.g. `BandCard`, `RemapperCard`, `FrequencyRangeEditor`). Those stay in `audio/` because they are used elsewhere (e.g. node body, other pickers).
