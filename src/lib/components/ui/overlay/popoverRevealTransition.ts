import type { TransitionConfig } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { readCssTimeMs } from '../../../../utils/readCssTimeMs';

export interface PopoverRevealParams {
  duration?: number;
  /** Enter from below (px); exit moves down by the same amount. */
  y?: number;
}

const DEFAULT_REVEAL: PopoverRevealParams = { duration: 165, y: 16 };

/** Read `--motion-popover-*` tokens (shared by floating panels and modal dialogs). */
export function readPopoverRevealParams(reducedMotion: boolean): PopoverRevealParams {
  if (typeof window === 'undefined') {
    return DEFAULT_REVEAL;
  }
  if (reducedMotion) {
    return { duration: 0, y: 0 };
  }
  const duration = readCssTimeMs('--motion-popover-duration');
  const offsetRaw = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-popover-offset-y')
    .trim();
  const offsetY = Number.parseFloat(offsetRaw);
  return {
    duration: Number.isFinite(duration) ? duration : DEFAULT_REVEAL.duration!,
    y: Number.isFinite(offsetY) ? Math.round(offsetY) : DEFAULT_REVEAL.y!,
  };
}

/**
 * Fade + vertical slide for popover content. Apply on an inner wrapper so the
 * outer shell can keep a static centering `transform` without fighting Svelte.
 */
export function popoverReveal(
  _node: HTMLElement,
  { duration = 165, y = 16 }: PopoverRevealParams = {},
): TransitionConfig {
  if (duration <= 0 || y <= 0) {
    return { duration: 0 };
  }

  return {
    duration,
    easing: cubicOut,
    css: (t, u) => `opacity: ${t}; transform: translateY(${u * y}px);`,
  };
}
