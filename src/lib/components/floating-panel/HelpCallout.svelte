<script lang="ts">
  /**
   * Floating panel that shows contextual node help / docs (e.g. from "Read Guide" or Help button).
   * Draggable popover with header (icon + "Guide" + close); body rendered by HelpCalloutContent.
   */
  import { Popover, Button, IconSvg } from '../ui';
  import type { HelpContent } from '../../../utils/ContextualHelpManager';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import HelpCalloutContent from './HelpCalloutContent.svelte';
  import HelpOverviewContent from './HelpOverviewContent.svelte';
  import FloatingPanel from './FloatingPanel.svelte';

  interface Props {
    visible?: boolean;
    /** Screen coordinates for positioning (center of panel when positionMode is 'center') */
    screenX?: number;
    screenY?: number;
    /** 'anchor' = top-left at (x,y); 'center' = center at (x,y) */
    positionMode?: 'anchor' | 'center';
    content?: HelpContent | null;
    /** Top-bar Help (no selection) vs node guide; affects chrome/copy. */
    helpMode?: 'overview' | 'node';
    /** Node type id when help is for a node (e.g. "noise"); used to resolve spec for port labels. */
    helpNodeType?: string;
    nodeSpecs?: Map<string, NodeSpec>;
    onClose?: () => void;
    /** When the user drags the panel, call with new center (x, y). Enables draggable panel. */
    onPositionChange?: (x: number, y: number) => void;
  }

  let {
    visible = false,
    screenX = 0,
    screenY = 0,
    positionMode = 'anchor',
    content = null,
    helpMode = 'node',
    helpNodeType,
    nodeSpecs = new Map(),
    onClose,
    onPositionChange,
  }: Props = $props();

  const align = $derived(positionMode === 'center' ? 'center' : 'start');
  const alignY = $derived(positionMode === 'center' ? 'center' : 'start');
  const isCenter = $derived(positionMode === 'center');

  const headerLabel = $derived(helpMode === 'overview' ? 'Overview' : 'Guide');
  const dialogAriaLabel = $derived(helpMode === 'overview' ? 'Help overview' : 'Node guide');

  let dragStart = $state<{ centerX: number; centerY: number; mouseX: number; mouseY: number } | null>(null);
  const DRAG_IGNORE_SELECTOR = 'button, input, select, textarea, a, [contenteditable="true"]';

  function startDrag(e: MouseEvent) {
    if (!onPositionChange) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(DRAG_IGNORE_SELECTOR)) return;
    e.preventDefault();
    dragStart = { centerX: screenX, centerY: screenY, mouseX: e.clientX, mouseY: e.clientY };
  }

  function onDocMouseMove(e: MouseEvent) {
    if (!dragStart || !onPositionChange) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.mouseX;
    const dy = e.clientY - dragStart.mouseY;
    onPositionChange(dragStart.centerX + dx, dragStart.centerY + dy);
  }

  function onDocMouseUp() {
    dragStart = null;
  }

  $effect(() => {
    if (!dragStart) return;
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
    return () => {
      document.removeEventListener('mousemove', onDocMouseMove);
      document.removeEventListener('mouseup', onDocMouseUp);
    };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      onClose();
    }
  }

  // Ensure Escape always works even if focus is inside a portal or never moved onto the dialog.
  $effect(() => {
    if (!visible) return;
    if (!onClose) return;
    function onDocKeydown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    document.addEventListener('keydown', onDocKeydown, true);
    return () => {
      document.removeEventListener('keydown', onDocKeydown, true);
    };
  });
</script>

{#if isCenter}
  <FloatingPanel
    open={visible}
    x={screenX}
    y={screenY}
    clampToViewport={false}
    closeOnClickOutside={false}
    onClose={() => onClose?.()}
    onPositionChange={onPositionChange}
    ariaLabel={dialogAriaLabel}
    onKeydown={handleKeydown}
    class="help-callout-panel is-visible"
  >
    {#snippet headerLeft()}
      <IconSvg name="book-open-text" variant="filled" />
      <span class="guide-label">{headerLabel}</span>
    {/snippet}

    {#snippet children()}
      <div
        class="help-callout-panel-body frame-elevated"
        class:help-callout-overview={helpMode === 'overview'}
      >
        {#if helpMode === 'overview'}
          <HelpOverviewContent />
        {:else if content}
          <HelpCalloutContent {content} {helpNodeType} {nodeSpecs} />
        {/if}
      </div>
    {/snippet}
  </FloatingPanel>
{:else}
  <Popover
    open={visible}
    x={screenX}
    y={screenY}
    align={align}
    alignY={alignY}
    closeOnClickOutside={false}
    onClose={onClose}
    class="help-callout-panel is-visible"
  >
    <div
      class="help-callout-panel-inner"
      class:dragging={dragStart !== null}
      role="dialog"
      aria-label={dialogAriaLabel}
      tabindex="-1"
      onkeydown={handleKeydown}
      onmousedown={onPositionChange ? startDrag : undefined}
    >
        <header class="picker-header">
          <div class="picker-header-left">
            <IconSvg name="book-open-text" variant="filled" />
            <span class="guide-label">{headerLabel}</span>
          </div>
          {#if onPositionChange}
            <div
              class="picker-drag-indicator"
              role="button"
              tabindex="0"
              aria-label="Drag to move panel"
              title="Drag to move panel"
              onmousedown={startDrag}
            >
              <IconSvg name="grip-horizontal" variant="line" />
            </div>
          {/if}
          <div class="picker-header-right">
            <Button
              variant="ghost"
              size="sm"
              mode="both"
              onclick={() => onClose?.()}
              aria-label="Close help"
            >
              Close
              <IconSvg name="x" variant="line" />
            </Button>
          </div>
        </header>

        <div
          class="help-callout-panel-body frame-elevated"
          class:help-callout-overview={helpMode === 'overview'}
        >
          {#if helpMode === 'overview'}
            <HelpOverviewContent />
          {:else if content}
            <HelpCalloutContent {content} {helpNodeType} {nodeSpecs} />
          {/if}
        </div>
      </div>
  </Popover>
{/if}

<style>
  /* Panel chrome: root, inner, scroll body. Content styles live in HelpCalloutContent. */
  :global(.help-callout-panel) {
    display: flex;
    flex-direction: column;
    padding: 0;
    min-width: 280px;
    max-width: 500px;
    max-height: 65vh;
    border: var(--frame-border);
    border-radius: var(--frame-border-radius);
    gap: 0;
    background: var(--frame-bg);
    box-shadow: var(--frame-shadow);
    font-size: var(--text-md);
    line-height: 1.6;
    z-index: var(--message-z-index);
    pointer-events: auto;
  }

  .help-callout-panel-inner {
    display: flex;
    flex-direction: column;
    outline: none;
    position: relative;
    z-index: 1;
    min-height: 0;
    padding: 0;
  }

  .help-callout-panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--pd-lg);
  }

  :global(.help-callout-panel-body::-webkit-scrollbar) {
    display: none;
  }

  .help-callout-panel-inner:focus {
    outline: none;
  }

  .help-callout-panel-inner.dragging {
    cursor: grabbing;
  }

  :global(.help-callout-panel) {
    /* FloatingPanel internal class mapping (keep HelpCallout styles intact) */
    :global(.content) {
      display: flex;
      flex-direction: column;
      outline: none;
      position: relative;
      z-index: 1;
      min-height: 0;
      padding: 0;

      &:focus {
        outline: none;
      }
    }

    :global(.content.dragging) {
      cursor: grabbing;
    }

    :global(.main) {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding: 0;
    }

    :global(.main::-webkit-scrollbar) {
      display: none;
    }

    .picker-header {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--pd-md);
      padding: var(--pd-xs);
      min-height: var(--size-sm);
    }

    .picker-header :global(.button) {
      border-radius: calc(var(--radius-md) - var(--pd-xs));
    }

    .picker-header-left {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: var(--pd-sm);
    }

    .picker-header-left :global(.icon-svg) {
      width: var(--icon-size-sm);
      height: var(--icon-size-sm);
    }

    .guide-label {
      font-size: var(--text-sm);
    }

    .picker-drag-indicator {
      position: absolute;
      left: 50%;
      top: 0;
      transform: translateX(-50%);
      width: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--pd-2xs) var(--pd-sm);
      color: var(--color-gray-90);
      background: var(--color-gray-50);
      border-radius: 0 0 var(--radius-md) var(--radius-md);
      user-select: none;
    }

    .picker-drag-indicator:hover {
      background: var(--ghost-bg-hover);
      color: var(--ghost-print-hover);
    }

    .picker-drag-indicator:active {
      background: var(--ghost-bg-active);
      color: var(--ghost-print-active);
      cursor: grabbing;
    }

    .picker-drag-indicator :global(.icon-svg) {
      width: 1rem;
      height: 1rem;
    }

    .picker-header-right {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
  }

  :global(.help-callout-panel) {
    /* Apply existing header styles to FloatingPanel header too */
    :global(.header) {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--pd-md);
      padding: var(--pd-xs);
      min-height: var(--size-sm);
    }

    :global(.header-left) {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: var(--pd-sm);
      color: var(--color-blue-100);
    }

    :global(.header-left .icon-svg) {
      width: var(--icon-size-sm);
      height: var(--icon-size-sm);
    }

    :global(.drag-indicator) {
      position: absolute;
      left: 50%;
      top: 0;
      transform: translateX(-50%);
      width: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--pd-2xs) var(--pd-sm);
      color: var(--color-gray-90);
      background: var(--color-gray-50);
      border-radius: 0 0 var(--radius-md) var(--radius-md);
      user-select: none;
    }

    :global(.drag-indicator:hover) {
      background: var(--ghost-bg-hover);
      color: var(--ghost-print-hover);
    }

    :global(.drag-indicator:active) {
      background: var(--ghost-bg-active);
      color: var(--ghost-print-active);
      cursor: grabbing;
    }

    :global(.drag-indicator .icon-svg) {
      width: 1rem;
      height: 1rem;
    }

    :global(.header-right) {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
  }
</style>
