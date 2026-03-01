/**
 * Bridge for canvas overlays (color picker, enum dropdown) to use Svelte components.
 * When provided to NodeEditorCanvas, UIElementManager uses these instead of vanilla instances.
 * Types are defined in types/editor; this module re-exports them for lib consumers.
 */

export type {
  OKLCHTriple,
  SignalSelectPayload,
  CanvasOverlayBridge,
  DropdownMenuItem,
} from '../types/editor';
