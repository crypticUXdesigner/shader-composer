<script lang="ts">
  /**
   * Vertical resize handle: vertically centered strip with offset outside the resized edge,
   * shared hover/active states. Used for side panel and split-view divider.
   */
  interface Props {
    /** Left edge position in px (edge of the panel/divider being resized). */
    edgeLeft: number;
    onMouseDown?: (e: MouseEvent) => void;
    /** When true, left position updates without transition (e.g. during drag). */
    disableTransition?: boolean;
    /** Which side of the edge the handle sits on: 'right' = outside the resized panel (default), 'left' = outside the pane on the right (e.g. preview). */
    side?: 'left' | 'right';
    /** Required when side is 'left': container width in px so we can position with right. */
    containerWidth?: number;
  }

  let { edgeLeft, onMouseDown, disableTransition = false, side = 'right', containerWidth = 0 }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_static_element_interactions - Resize handle has role=separator -->
<div
  class="vertical-resize-handle"
  class:no-transition={disableTransition}
  class:side-left={side === 'left'}
  role="separator"
  aria-orientation="vertical"
  style={side === 'left' ? `right: ${containerWidth - edgeLeft}px;` : `left: ${edgeLeft}px;`}
  onmousedown={onMouseDown}
></div>

<style>
  .vertical-resize-handle {
    position: absolute;
    top: 50%;
    transform: translate(var(--pd-2xs), -50%);
    width: 18px;
    height: 80px;
    z-index: var(--z-resize-handle);
    cursor: col-resize;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vertical-resize-handle.side-left {
    transform: translate(var(--pd-2xs), -50%);
  }

  .vertical-resize-handle.side-left {
    left: unset;
  }

  .vertical-resize-handle.no-transition {
    transition: none;
  }

  .vertical-resize-handle::before {
    content: '';
    position: absolute;
    inset: 0;
    margin: auto;
    width: 4px;
    height: 60px;
    border-radius: 4px;
    background: var(--divider);
    transition: background 0.15s ease;
  }

  .vertical-resize-handle:hover::before {
    background: var(--print-highlight);
  }

  .vertical-resize-handle:active::before {
    background: var(--color-teal-110);
  }
</style>
