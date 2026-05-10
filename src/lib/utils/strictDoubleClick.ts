/**
 * Stricter double-activation timing than OS/browser multi-click settings.
 * Uses a shorter max delta than typical system double-click intervals (see options).
 */

export const STRICT_DOUBLE_CLICK_MAX_MS = 320;
export const STRICT_DOUBLE_CLICK_MAX_MOVE_PX = 6;

export type StrictDoubleClickOptions = {
  maxMs?: number;
  maxMovePx?: number;
};

type PointStamp = Pick<MouseEvent | PointerEvent, 'timeStamp' | 'clientX' | 'clientY'>;

function resolvedOpts(o?: StrictDoubleClickOptions) {
  const maxMs = o?.maxMs ?? STRICT_DOUBLE_CLICK_MAX_MS;
  const maxMovePx = o?.maxMovePx ?? STRICT_DOUBLE_CLICK_MAX_MOVE_PX;
  return { maxMs, maxMoveSq: maxMovePx * maxMovePx };
}

function distSqXY(a: PointStamp, b: PointStamp): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return dx * dx + dy * dy;
}

/** Mouse primary button only — matches “double-click” semantics; touch/pen use no arm/consume here. */
function isPrimaryMousePointer(e: PointerEvent): boolean {
  return e.pointerType === 'mouse' && e.button === 0;
}

/**
 * Handles pairs of bubbling `click` events: invokes callback only when the second click
 * completes a strict double (time + movement versus the prior click).
 */
export function createStrictDoubleClickHandler(
  onDoubleClick: (e: MouseEvent) => void,
  options?: StrictDoubleClickOptions
): (e: MouseEvent) => void {
  const { maxMs, maxMoveSq } = resolvedOpts(options);
  let prev: PointStamp | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const disarm = () => {
    prev = null;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return (e: MouseEvent) => {
    const now: PointStamp = e;

    const isSecond =
      prev !== null &&
      now.timeStamp - prev.timeStamp <= maxMs &&
      distSqXY(now, prev) <= maxMoveSq;

    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    if (isSecond) {
      prev = null;
      onDoubleClick(e);
      return;
    }

    prev = now;
    timer = setTimeout(disarm, maxMs + 20);
  };
}

/**
 * For controls that call `preventDefault()` on `pointerdown` (so `click` may not fire):
 * arm on a completed primary-button mouse tap (`pointerup`), consume on the next `pointerdown`.
 */
export function createStrictTapThenDownDouble(options?: StrictDoubleClickOptions): {
  consumeIfSecondPress(e: PointerEvent): boolean;
  recordCompletedPrimaryTap(e: PointerEvent): void;
  reset(): void;
} {
  const { maxMs, maxMoveSq } = resolvedOpts(options);
  let tapEnd: PointStamp | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const disarm = () => {
    tapEnd = null;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return {
    reset: disarm,

    recordCompletedPrimaryTap(e: PointerEvent): void {
      if (!isPrimaryMousePointer(e)) return;
      tapEnd = { timeStamp: e.timeStamp, clientX: e.clientX, clientY: e.clientY };
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(disarm, maxMs + 40);
    },

    consumeIfSecondPress(e: PointerEvent): boolean {
      if (!isPrimaryMousePointer(e)) return false;
      if (tapEnd === null) return false;
      const candidate: PointStamp = e;
      if (candidate.timeStamp - tapEnd.timeStamp > maxMs || distSqXY(candidate, tapEnd) > maxMoveSq) {
        disarm();
        return false;
      }
      disarm();
      return true;
    },
  };
}

/**
 * Coalescing double detection for non-click moments (e.g. `mouseup` that ends a click).
 * Call with the same screen client point each time the user completes a "click-like" release
 * while the hit target is unchanged; returns true only on the second qualifying event.
 */
export function createStrictDoubleClickNoteHandler(
  onDoubleEvent: (e: MouseEvent) => void,
  options?: StrictDoubleClickOptions
): (e: MouseEvent) => void {
  const { maxMs, maxMoveSq } = resolvedOpts(options);
  let prev: PointStamp | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const disarm = () => {
    prev = null;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return (e: MouseEvent) => {
    const now: PointStamp = e;

    const isSecond =
      prev !== null &&
      now.timeStamp - prev.timeStamp <= maxMs &&
      distSqXY(now, prev) <= maxMoveSq;

    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    if (isSecond) {
      prev = null;
      onDoubleEvent(e);
      return;
    }

    prev = now;
    timer = setTimeout(disarm, maxMs + 20);
  };
}
