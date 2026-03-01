/**
 * Action to add a wheel event listener with { passive: false }.
 * Use when the handler calls preventDefault() to avoid scroll/zoom.
 * Required to suppress "[Violation] Added non-passive event listener" warnings.
 */
import type { Action } from 'svelte/action';

export const wheelNonPassive: Action<
  HTMLElement,
  (e: WheelEvent) => void
> = (node, handler) => {
  let currentHandler = handler;
  const bound = (e: WheelEvent) => currentHandler?.(e);
  node.addEventListener('wheel', bound, { passive: false });
  return {
    update(newHandler) {
      currentHandler = newHandler;
    },
    destroy() {
      node.removeEventListener('wheel', bound);
    },
  };
};
