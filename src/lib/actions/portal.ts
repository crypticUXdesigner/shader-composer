/** Return type for the portal action (destroy cleans up). */
export type PortalActionReturn = { destroy: () => void };

/**
 * Portal action: moves the element to document.body when mounted.
 * Use for overlays (Popover, Modal) to avoid overflow clipping.
 */
export function portal(node: HTMLElement, target: HTMLElement = document.body): PortalActionReturn {
  target.appendChild(node);
  return {
    destroy() {
      node.remove();
    }
  };
}
