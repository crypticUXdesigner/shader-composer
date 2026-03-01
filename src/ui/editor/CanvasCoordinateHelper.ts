/**
 * CanvasCoordinateHelper - Screen/canvas coordinate conversion and DOM port position queries.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

export interface CanvasCoordinateHelperDeps {
  canvas: HTMLCanvasElement;
  viewStateManager: {
    screenToCanvas: (sx: number, sy: number, rect: DOMRect) => { x: number; y: number };
    canvasToScreen: (cx: number, cy: number, rect: DOMRect) => { x: number; y: number };
  };
  /** When set, used for connection/param port coords so screen→canvas matches node positions. */
  getConnectionRect: () => DOMRect | null;
  /** Fallback when getConnectionRect returns null (e.g. parameterConnectionsOverlayCanvas ?? canvas). */
  getFallbackRect: () => DOMRect;
}

/**
 * Convert screen (client) coordinates to canvas coordinates.
 * Uses the connection rect when set so hit testing and connection drawing match the DOM node layer
 * (which is laid out in the same container). Falls back to canvas rect when connection rect is null.
 */
export function screenToCanvas(deps: CanvasCoordinateHelperDeps, screenX: number, screenY: number): { x: number; y: number } {
  const rect = getCanvasRectForConnections(deps);
  return deps.viewStateManager.screenToCanvas(screenX, screenY, rect);
}

export function getCanvasRectForConnections(deps: CanvasCoordinateHelperDeps): DOMRect {
  const fromProvider = deps.getConnectionRect();
  if (fromProvider) return fromProvider;
  return deps.getFallbackRect();
}

export function getParamPortPositionsFromDOM(deps: CanvasCoordinateHelperDeps): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const rect = getCanvasRectForConnections(deps);
  const els = document.querySelectorAll('.param-port[data-node-id][data-param-name]');
  for (const el of els) {
    const nodeId = (el as HTMLElement).getAttribute('data-node-id');
    const paramName = (el as HTMLElement).getAttribute('data-param-name');
    if (!nodeId || !paramName) continue;
    const portCircle = el.querySelector('.port-circle') as HTMLElement | null;
    const elRect = portCircle ? portCircle.getBoundingClientRect() : (el as HTMLElement).getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2;
    const centerY = elRect.top + elRect.height / 2;
    const canvasPos = deps.viewStateManager.screenToCanvas(centerX, centerY, rect);
    result.set(`${nodeId}:${paramName}`, canvasPos);
  }
  return result;
}

export function getHeaderOutputPortPositionsFromDOM(deps: CanvasCoordinateHelperDeps): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const canvasRect = getCanvasRectForConnections(deps);
  const els = document.querySelectorAll('.port.output-port');
  for (const el of els) {
    const portKey = (el as HTMLElement).getAttribute('data-port-key');
    const nodeEl = (el as HTMLElement).closest('.node[data-node-id]') as HTMLElement | null;
    if (!portKey || !nodeEl || !portKey.startsWith('output:')) continue;
    const nodeId = nodeEl.getAttribute('data-node-id');
    if (!nodeId) continue;
    const portName = portKey.slice(7);
    const portDot = el.querySelector('.dot') as HTMLElement | null;
    const elRect = portDot ? portDot.getBoundingClientRect() : (el as HTMLElement).getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2;
    const centerY = elRect.top + elRect.height / 2;
    const canvasPos = deps.viewStateManager.screenToCanvas(centerX, centerY, canvasRect);
    result.set(`${nodeId}:output:${portName}`, canvasPos);
  }
  return result;
}

export function canvasToScreen(deps: CanvasCoordinateHelperDeps, canvasX: number, canvasY: number): { x: number; y: number } {
  const rect = deps.canvas.getBoundingClientRect();
  return deps.viewStateManager.canvasToScreen(canvasX, canvasY, rect);
}
