# Audio components

Shared **audio UI widgets** and **signal connection picker**. Used by:

- **Floating panels** (`../floating-panel/`): `BandCard`, `RemapperCard`, `FrequencyRangeEditor`, etc. are used by `AudioSignalPickerLargeContent` and `AudioSignalPickerCompact`.
- **Node body** (`../node/`): `FrequencyRangeEditor` is used in `NodeBody.svelte`.
- **App / overlay**: `SignalConnectionPicker` is exposed via `@/lib/components` for the canvas overlay.

## What lives here

| File | Used by |
|------|---------|
| **SignalConnectionPicker.svelte** | Canvas overlay (signal connection flow). |
| **BandCard.svelte** | AudioSignalPickerLargeContent (floating-panel). |
| **RemapperCard.svelte** | AudioSignalPickerLargeContent (floating-panel). |
| **FrequencyRangeEditor.svelte** | AudioSignalPickerLargeContent, AudioSignalPickerCompact, NodeBody. |
| **SpectrumStrip.svelte**, **FrequencyScale.svelte**, **frequencyUtils** | Frequency/spectrum UI. |

The **audio signal floating panel** (picker shell + large/compact content) lives in `../floating-panel/`; only the reusable widgets and the separate `SignalConnectionPicker` remain here.
