<script lang="ts">
  /**
   * Preview container: positions the preview in node/split/full view and handles
   * drag/resize in node view (corner widget) with snap-to-edges and anchor-on-resize.
   */
  import type { ViewMode } from './types';

  type CornerWidgetAnchor = {
    horizontal: 'left' | 'right';
    vertical: 'top' | 'bottom';
    left: number;
    right: number;
    top: number;
    bottom: number;
  };

  interface Props {
    preview?: import('svelte').Snippet<[]>;
    viewMode?: ViewMode;
    /** Left offset of content area (e.g. panel width). */
    panelOffset?: number;
    /** Width of content area (container minus panel). */
    contentWidth?: number;
    /** Divider position 0..1 when viewMode is 'split'. */
    dividerPosition?: number;
    containerWidth?: number;
    containerHeight?: number;
    topBarHeight?: number;
    bottomSafeInset?: number;
  /** Layout container element for bounds (optional until mounted). */
  containerEl?: HTMLDivElement | undefined;
  /** When true, disables transition (e.g. while parent is resizing divider/panel). */
  disableTransition?: boolean;
}

  let {
    preview,
    viewMode = 'node',
    panelOffset = 0,
    contentWidth = 0,
    dividerPosition = 0.5,
    containerWidth = 0,
    containerHeight = 0,
    topBarHeight = 60,
  bottomSafeInset = 16,
  containerEl,
  disableTransition = false,
}: Props = $props();

  const SNAP_DISTANCE = 20;
  const SAFE_DISTANCE = 16;
  const INITIAL_WIDGET_WIDTH = 320;
  const INITIAL_WIDGET_HEIGHT = 240;
  const RESIZE_DEBOUNCE_MS = 320;

  let previewContainerEl = $state<HTMLDivElement | undefined>(undefined);
  let cornerWidgetSize = $state({ width: INITIAL_WIDGET_WIDTH, height: INITIAL_WIDGET_HEIGHT });
  let cornerWidgetPosition = $state({ x: 0, y: 60 });
  let cornerWidgetAnchor = $state<CornerWidgetAnchor | null>(null);
  let snappedCorner = $state<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>('top-right');

  let isDraggingCornerWidget = $state(false);
  let isResizingCornerWidget = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let dragStartWidgetX = $state(0);
  let dragStartWidgetY = $state(0);
  let dragDelta = $state({ x: 0, y: 0 });
  let resizeStartWidth = $state(0);
  let resizeStartHeight = $state(0);
  let resizeX = $state(0);
  let resizeY = $state(0);
  let resizeStartX = $state(0);
  let resizeStartY = $state(0);

  let resizeMoveRafId = 0;
  let latestMoveEvent: MouseEvent | null = null;
  let hasInitializedCornerPosition = false;
  let prevViewMode = $state<ViewMode>('node');

  function snapToEdges(
    x: number,
    y: number,
    width: number,
    height: number,
    viewportWidth: number,
    viewportHeight: number
  ): { x: number; y: number } {
    const distToLeft = x - SAFE_DISTANCE;
    const distToRight = viewportWidth - SAFE_DISTANCE - (x + width);
    const distToTop = y - topBarHeight;
    const distToBottom = viewportHeight - bottomSafeInset - (y + height);

    let snappedX = x;
    let snappedY = y;
    let snappedToLeft = false;
    let snappedToRight = false;
    let snappedToTop = false;
    let snappedToBottom = false;

    if (Math.abs(distToLeft) < SNAP_DISTANCE) {
      snappedX = SAFE_DISTANCE;
      snappedToLeft = true;
    } else if (Math.abs(distToRight) < SNAP_DISTANCE) {
      snappedX = viewportWidth - width - SAFE_DISTANCE;
      snappedToRight = true;
    }

    if (Math.abs(distToTop) < SNAP_DISTANCE) {
      snappedY = topBarHeight;
      snappedToTop = true;
    } else if (Math.abs(distToBottom) < SNAP_DISTANCE) {
      snappedY = viewportHeight - height - bottomSafeInset;
      snappedToBottom = true;
    }

    if (snappedToTop && snappedToLeft) snappedCorner = 'top-left';
    else if (snappedToTop && snappedToRight) snappedCorner = 'top-right';
    else if (snappedToBottom && snappedToLeft) snappedCorner = 'bottom-left';
    else if (snappedToBottom && snappedToRight) snappedCorner = 'bottom-right';
    else snappedCorner = null;

    const minX = SAFE_DISTANCE;
    const maxX = viewportWidth - width - SAFE_DISTANCE;
    const minY = topBarHeight;
    const maxY = viewportHeight - height - bottomSafeInset;
    snappedX = Math.max(minX, Math.min(maxX, snappedX));
    snappedY = Math.max(minY, Math.min(maxY, snappedY));
    return { x: snappedX, y: snappedY };
  }

  function computeAnchorFromPosition(
    x: number,
    y: number,
    width: number,
    height: number,
    viewportWidth: number,
    viewportHeight: number,
    topBarH: number,
    bottomSafe: number
  ): CornerWidgetAnchor {
    const left = x;
    const right = viewportWidth - (x + width);
    const top = y;
    const bottom = viewportHeight - (y + height);
    const horizontal: CornerWidgetAnchor['horizontal'] =
      snappedCorner === 'top-left' || snappedCorner === 'bottom-left' || x + width / 2 < viewportWidth / 2 ? 'left' : 'right';
    const vertical: CornerWidgetAnchor['vertical'] =
      snappedCorner === 'top-left' || snappedCorner === 'top-right' || y + height / 2 < (topBarH + viewportHeight - bottomSafe) / 2 ? 'top' : 'bottom';
    return { horizontal, vertical, left, right, top, bottom };
  }

  function applyAnchorToPosition(
    anchor: CornerWidgetAnchor,
    width: number,
    height: number,
    viewportWidth: number,
    viewportHeight: number,
    topBarH: number,
    bottomSafe: number
  ): { x: number; y: number } {
    const x = anchor.horizontal === 'left' ? anchor.left : viewportWidth - width - anchor.right;
    const y = anchor.vertical === 'top' ? anchor.top : viewportHeight - height - anchor.bottom;
    const minX = SAFE_DISTANCE;
    const maxX = viewportWidth - width - SAFE_DISTANCE;
    const minY = topBarH;
    const maxY = viewportHeight - height - bottomSafe;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }

  function onPreviewMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.resize-handle') || target.closest('button')) return;
    isDraggingCornerWidget = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartWidgetX = cornerWidgetPosition.x;
    dragStartWidgetY = cornerWidgetPosition.y;
    e.preventDefault();
  }

  function onResizeHandleMouseDown(e: MouseEvent, rx: number, ry: number) {
    isResizingCornerWidget = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    resizeStartWidth = cornerWidgetSize.width;
    resizeStartHeight = cornerWidgetSize.height;
    resizeX = rx;
    resizeY = ry;
    resizeStartX = cornerWidgetPosition.x;
    resizeStartY = cornerWidgetPosition.y;
    e.preventDefault();
    e.stopPropagation();
  }

  const previewContainerStyle = $derived.by(() => {
    const base = 'overflow: hidden; background: var(--layout-preview-bg);';
    if (viewMode === 'full') {
      return `${base} position: absolute; left: ${panelOffset}px; top: 0; width: calc(100% - ${panelOffset}px); bottom: 0; border: none; border-radius: 0; cursor: default; z-index: 1;`;
    }
    if (viewMode === 'split') {
      const left = panelOffset + contentWidth * dividerPosition + 4;
      const width = contentWidth * (1 - dividerPosition) - 4;
      return `${base} position: absolute; left: ${left}px; top: 0; bottom: 0; width: ${width}px; border: none; border-radius: 0; cursor: default; z-index: 1;`;
    }
    const transform = dragDelta.x !== 0 || dragDelta.y !== 0 ? ` transform: translate(${dragDelta.x}px, ${dragDelta.y}px);` : '';
    return `${base} position: fixed; left: ${cornerWidgetPosition.x}px; top: ${cornerWidgetPosition.y}px; width: ${cornerWidgetSize.width}px; height: ${cornerWidgetSize.height}px; border: var(--layout-preview-border); border-radius: var(--button-radius, 4px); cursor: move; z-index: 50;${transform}`;
  });

  // When switching from split/full to node, set initial position to top-right
  $effect(() => {
    const mode = viewMode;
    const wasSplitOrFull = prevViewMode === 'split' || prevViewMode === 'full';
    prevViewMode = mode;
    if (mode !== 'node' || !containerEl || !wasSplitOrFull) return;
    const th = topBarHeight;
    const rect = containerEl.getBoundingClientRect();
    const w = cornerWidgetSize.width;
    const h = cornerWidgetSize.height;
    const pos = {
      x: rect.width - w - SAFE_DISTANCE,
      y: th,
    };
    cornerWidgetPosition = pos;
    snappedCorner = 'top-right';
    cornerWidgetAnchor = computeAnchorFromPosition(
      pos.x,
      pos.y,
      w,
      h,
      rect.width,
      rect.height,
      th,
      bottomSafeInset
    );
  });

  // Initial corner position on first mount
  $effect(() => {
    if (!containerEl || hasInitializedCornerPosition || viewMode !== 'node') return;
    hasInitializedCornerPosition = true;
    const rect = containerEl.getBoundingClientRect();
    const w = cornerWidgetSize.width;
    const h = cornerWidgetSize.height;
    const pos = {
      x: rect.width - w - SAFE_DISTANCE,
      y: topBarHeight,
    };
    cornerWidgetPosition = pos;
    cornerWidgetAnchor = computeAnchorFromPosition(
      pos.x,
      pos.y,
      w,
      h,
      rect.width,
      rect.height,
      topBarHeight,
      bottomSafeInset
    );
  });

  // Keep preview anchored to same edge when container resizes (node view)
  $effect(() => {
    if (
      viewMode !== 'node' ||
      !cornerWidgetAnchor ||
      !containerEl ||
      containerWidth <= 0 ||
      containerHeight <= 0 ||
      isDraggingCornerWidget ||
      isResizingCornerWidget
    )
      return;
    const pos = applyAnchorToPosition(
      cornerWidgetAnchor,
      cornerWidgetSize.width,
      cornerWidgetSize.height,
      containerWidth,
      containerHeight,
      topBarHeight,
      bottomSafeInset
    );
    cornerWidgetPosition = pos;
  });

  // Global mouse handlers for corner widget drag/resize (throttled with rAF)
  $effect(() => {
    if (!isDraggingCornerWidget && !isResizingCornerWidget) return;

    function applyMove(e: MouseEvent) {
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      if (isDraggingCornerWidget) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        dragDelta = { x: dx, y: dy };

        if (snappedCorner) {
          let expectedX = 0,
            expectedY = 0;
          const w = cornerWidgetSize.width,
            h = cornerWidgetSize.height;
          switch (snappedCorner) {
            case 'top-left':
              expectedX = SAFE_DISTANCE;
              expectedY = topBarHeight;
              break;
            case 'top-right':
              expectedX = rect.width - w - SAFE_DISTANCE;
              expectedY = topBarHeight;
              break;
            case 'bottom-left':
              expectedX = SAFE_DISTANCE;
              expectedY = rect.height - h - bottomSafeInset;
              break;
            case 'bottom-right':
              expectedX = rect.width - w - SAFE_DISTANCE;
              expectedY = rect.height - h - bottomSafeInset;
              break;
          }
          const newX = dragStartWidgetX + dx;
          const newY = dragStartWidgetY + dy;
          if (Math.abs(newX - expectedX) > SNAP_DISTANCE || Math.abs(newY - expectedY) > SNAP_DISTANCE) {
            snappedCorner = null;
          }
        }
      } else if (isResizingCornerWidget) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        const minW = 400;
        const minH = 120;
        const maxW = rect.width * 0.5;
        const maxH = rect.height * 0.5;

        let newWidth = resizeStartWidth;
        let newHeight = resizeStartHeight;
        let newX = resizeStartX;
        let newY = resizeStartY;

        if (resizeX === 1) {
          newWidth = Math.max(minW, Math.min(maxW, resizeStartWidth + deltaX));
        } else if (resizeX === -1) {
          const proposed = resizeStartWidth - deltaX;
          if (proposed >= minW) {
            newWidth = Math.min(maxW, proposed);
            newX = resizeStartX + deltaX;
          }
        }
        if (resizeY === 1) {
          newHeight = Math.max(minH, Math.min(maxH, resizeStartHeight + deltaY));
        } else if (resizeY === -1) {
          const proposed = resizeStartHeight - deltaY;
          if (proposed >= minH) {
            newHeight = Math.min(maxH, proposed);
            newY = resizeStartY + deltaY;
          }
        }

        const minX = SAFE_DISTANCE;
        const maxX = rect.width - newWidth - SAFE_DISTANCE;
        const minY = topBarHeight;
        const maxY = rect.height - newHeight - bottomSafeInset;
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        cornerWidgetSize = { width: newWidth, height: newHeight };
        const snapped = snapToEdges(newX, newY, newWidth, newHeight, rect.width, rect.height);
        cornerWidgetPosition = snapped;
        cornerWidgetAnchor = computeAnchorFromPosition(
          snapped.x,
          snapped.y,
          newWidth,
          newHeight,
          rect.width,
          rect.height,
          topBarHeight,
          bottomSafeInset
        );
      }
    }

    const onMove = (e: MouseEvent) => {
      latestMoveEvent = e;
      if (resizeMoveRafId) return;
      resizeMoveRafId = requestAnimationFrame(() => {
        resizeMoveRafId = 0;
        const ev = latestMoveEvent;
        if (ev) applyMove(ev);
      });
    };

    const onUp = () => {
      if (resizeMoveRafId) {
        cancelAnimationFrame(resizeMoveRafId);
        resizeMoveRafId = 0;
      }
      latestMoveEvent = null;
      if (isDraggingCornerWidget && containerEl) {
        const rect = containerEl.getBoundingClientRect();
        const newX = dragStartWidgetX + dragDelta.x;
        const newY = dragStartWidgetY + dragDelta.y;
        const w = cornerWidgetSize.width;
        const h = cornerWidgetSize.height;
        const snapped = snapToEdges(newX, newY, w, h, rect.width, rect.height);
        cornerWidgetPosition = snapped;
        cornerWidgetAnchor = computeAnchorFromPosition(
          snapped.x,
          snapped.y,
          w,
          h,
          rect.width,
          rect.height,
          topBarHeight,
          bottomSafeInset
        );
        dragDelta = { x: 0, y: 0 };
      }
      isDraggingCornerWidget = false;
      isResizingCornerWidget = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      if (resizeMoveRafId) cancelAnimationFrame(resizeMoveRafId);
      resizeMoveRafId = 0;
      latestMoveEvent = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  });

  // ResizeObserver for preview – debounced so panel open/close doesn't fire every frame
  $effect(() => {
    const el = previewContainerEl;
    if (!el) return;
    let resizeDebounceId = 0;
    const scheduleResize = () => {
      if (resizeDebounceId) window.clearTimeout(resizeDebounceId);
      resizeDebounceId = window.setTimeout(() => {
        resizeDebounceId = 0;
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
        });
      }, RESIZE_DEBOUNCE_MS);
    };
    const ro = new ResizeObserver(scheduleResize);
    ro.observe(el);
    const canvas = el.querySelector('canvas');
    if (canvas) ro.observe(canvas);
    const mo = new MutationObserver(() => {
      const c = el.querySelector('canvas');
      if (c) ro.observe(c);
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      if (resizeDebounceId) window.clearTimeout(resizeDebounceId);
      ro.disconnect();
      mo.disconnect();
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions - Preview container captures mousedown for canvas drag in node view -->
<div
  bind:this={previewContainerEl}
  class="preview-container"
  class:node-view={viewMode === 'node'}
  class:no-transition={disableTransition}
  style={previewContainerStyle}
  onmousedown={viewMode === 'node' ? onPreviewMouseDown : undefined}
>
  {#if preview}
    {@render preview()}
  {/if}
  {#if viewMode === 'node'}
    <!-- svelte-ignore a11y_no_static_element_interactions - Mouse-only resize handles at preview corners -->
    <div
      class="resize-handle"
      style="position: absolute; top: 0; left: 0; cursor: nwse-resize; z-index: 10; width: 16px; height: 16px; background: transparent;"
      onmousedown={(e) => onResizeHandleMouseDown(e, -1, -1)}></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resize-handle"
      style="position: absolute; top: 0; right: 0; cursor: nesw-resize; z-index: 10; width: 16px; height: 16px; background: transparent;"
      onmousedown={(e) => onResizeHandleMouseDown(e, 1, -1)}></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resize-handle"
      style="position: absolute; bottom: 0; left: 0; cursor: nesw-resize; z-index: 10; width: 16px; height: 16px; background: transparent;"
      onmousedown={(e) => onResizeHandleMouseDown(e, -1, 1)}></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resize-handle"
      style="position: absolute; bottom: 0; right: 0; cursor: nwse-resize; z-index: 10; width: 16px; height: 16px; background: transparent;"
      onmousedown={(e) => onResizeHandleMouseDown(e, 1, 1)}></div>
  {/if}
</div>

<style>
  .preview-container {
    transition: left 0.3s ease, width 0.3s ease;
  }

  .preview-container.node-view,
  .preview-container.no-transition {
    transition: none;
  }
</style>
