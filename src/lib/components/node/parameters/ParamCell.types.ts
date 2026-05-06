import type { Snippet } from 'svelte';

/** Public props for `ParamCell.svelte` (shared so parents type-check against the same shape). */
export interface ParamCellProps {
  /** When true, applies .connected styling (bg/border). */
  connected?: boolean;
  /** Extra class(es) for the root (e.g. span-2-cols, coord-pad-with-ports). */
  class?: string;
  /** Optional feature flags (tests/automation and UI affordances). */
  supportsAudio?: boolean;
  supportsAnimation?: boolean;
  /** Label text in the left column top row. Ignored when `inlineControl` is true. */
  label: string;
  /**
   * When true, render only the control area in a compact shell (no label column).
   * Use for inline toggles in group headers, etc.
   */
  inlineControl?: boolean;
  /** When true, show a small icon that the parameter is driven by timeline automation (full timeline, not only inside regions). */
  timelineDriven?: boolean;
  /** Optional snippet for left column bottom (port row(s)). */
  leftBottom?: Snippet;
  /** Snippet for the control slot (slider, pad, etc.). */
  control: Snippet;
  /** Default slot (accepted but unused; layout uses leftBottom + control). */
  children?: Snippet;
}
