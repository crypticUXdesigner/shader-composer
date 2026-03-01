/**
 * DocumentListeners - Attaches/detaches document-level pointer move/up listeners.
 * Extracted from NodeEditorCanvas to reduce its size.
 *
 * Uses pointer events (not mouse) so the release is received when the drag started
 * from pointerdown (e.g. port connection); some browsers do not fire mouseup after
 * pointerdown in that flow.
 *
 * When pointerId is provided, sets pointer capture on document.body so that all
 * subsequent pointer events (move, up) are delivered to the document even when
 * the pointer is over other elements (e.g. releasing over a port). This fixes
 * connection creation when the release would otherwise not reach our listeners.
 * Also listens for mouseup as a fallback for environments where pointerup is not
 * delivered when releasing over a different element.
 */

export interface DocumentListenersApi {
  attach(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void, pointerId?: number): void;
  detach(): void;
}

/** Single handler type for both PointerEvent and MouseEvent (both have clientX/clientY). */
type UpHandler = (e: PointerEvent | MouseEvent) => void;

/**
 * Creates a helper that manages document-level pointermove, pointerup, and mouseup listeners.
 * Used when dragging continues outside the canvas (e.g. port connection).
 */
export function createDocumentListeners(): DocumentListenersApi {
  let moveHandler: ((e: PointerEvent) => void) | null = null;
  let upHandler: UpHandler | null = null;

  return {
    attach(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void, pointerId?: number): void {
      if (moveHandler !== null || upHandler !== null) return;
      moveHandler = onMove;
      upHandler = onUp as UpHandler;
      document.addEventListener('pointermove', moveHandler);
      document.addEventListener('pointerup', upHandler as EventListener);
      document.addEventListener('pointercancel', upHandler as EventListener);
      document.addEventListener('mouseup', upHandler as EventListener);
      if (pointerId !== undefined && typeof document.body.setPointerCapture === 'function') {
        try {
          document.body.setPointerCapture(pointerId);
        } catch {
          // Capture can fail if already captured or pointer not active; continue without it
        }
      }
    },

    detach(): void {
      if (moveHandler !== null) {
        document.removeEventListener('pointermove', moveHandler);
        moveHandler = null;
      }
      if (upHandler !== null) {
        document.removeEventListener('pointerup', upHandler as EventListener);
        document.removeEventListener('pointercancel', upHandler as EventListener);
        document.removeEventListener('mouseup', upHandler as EventListener);
        upHandler = null;
      }
    }
  };
}
