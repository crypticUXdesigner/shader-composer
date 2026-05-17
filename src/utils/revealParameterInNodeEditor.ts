export type FocusNodeInEditor = (
  nodeId: string,
  options?: { zoom?: number; targetScreenYFrac?: number }
) => void;

/**
 * Pan/zoom the node editor to a node and focus its parameter port (DOM overlay).
 */
export function revealParameterInNodeEditor(
  focusNode: FocusNodeInEditor | undefined,
  nodeId: string,
  paramName: string
): void {
  focusNode?.(nodeId, { zoom: 0.8, targetScreenYFrac: 0.34 });
  queueMicrotask(() => {
    const esc = (v: string) =>
      typeof CSS !== 'undefined' && 'escape' in CSS
        ? (CSS as unknown as { escape(s: string): string }).escape(v)
        : v;
    const selector = `.param-port[data-node-id="${esc(nodeId)}"][data-param-name="${esc(paramName)}"]`;
    const el = document.querySelector(selector) as HTMLElement | null;
    el?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    el?.focus?.({ preventScroll: true });
  });
}
