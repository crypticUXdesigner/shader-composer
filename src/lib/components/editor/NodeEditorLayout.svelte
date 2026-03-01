<script lang="ts">
  /**
   * Node Editor Layout - Svelte 5 Migration WP 04A
   * Split view with resizable divider, corner widget, preset dropdown, zoom, help, panel toggle.
   */
  import { Message, DropdownMenu, Modal, Button } from '../ui';
  import type { DropdownMenuItem } from '../ui';
  import { TopBar, KeyboardShortcutsModal } from '../top-bar';
  import { SidePanel } from '../side-panel';
  import VerticalResizeHandle from './VerticalResizeHandle.svelte';
  import PreviewContainer from './PreviewContainer.svelte';
  import { portal } from '../../actions/portal';
  import { getGraph } from '../../stores';
  import { globalErrorHandler } from '../../../utils/errorHandling';
  import type { ViewMode, LayoutCallbacks } from './types';

  interface Props {
    preview?: import('svelte').Snippet<[]>;
    nodeEditor?: import('svelte').Snippet<[]>;
    panel?: import('svelte').Snippet<[]>;
    docsPanel?: import('svelte').Snippet<[]>;
    bottomBar?: import('svelte').Snippet<[string | null]>;
    callbacks?: LayoutCallbacks;
    presetList?: Array<{ name: string; displayName: string }>;
    selectedPreset?: string | null;
    /** Primary track key so bottom bar re-renders when track changes (waveform scrubber). */
    primaryTrackKey?: string | null;
    isPanelVisible?: boolean;
    zoom?: number;
    fps?: number;
    /** When false, top bar disables video export and shows WebCodecs message. */
    isVideoExportSupported?: boolean;
  }

  let {
    preview,
    nodeEditor,
    panel,
    docsPanel,
    bottomBar,
    callbacks = {},
    presetList = [],
    selectedPreset = null,
    primaryTrackKey = null,
    isPanelVisible = false,
    zoom = 1.0,
    fps = 0,
    isVideoExportSupported = true,
  }: Props = $props();

  const SAFE_DISTANCE = 16;
  const PANEL_MIN_WIDTH = 250;
  const PANEL_MAX_WIDTH = 800;

  // State
  let containerEl = $state<HTMLDivElement | undefined>(undefined);
  let buttonContainerEl = $state<HTMLDivElement | undefined>(undefined);
  let presetMenuOpen = $state(false);
  let presetMenuX = $state(0);
  let presetMenuY = $state(0);
  let presetMenuItems = $state<DropdownMenuItem[]>([]);

  let viewMode = $state<ViewMode>('node');
  let activeTab = $state<'nodes' | 'docs'>('nodes');
  let dividerPosition = $state(0.5);
  let panelWidth = $state(300);

  let isDraggingDivider = $state(false);
  let isResizingPanel = $state(false);
  /** True only after panel open animation (0.3s) has finished; hides instantly when panel starts closing. */
  let showPanelResizeHandle = $state(false);
  let panelOpenTimeoutId = 0;
  let panelResizeStartX = $state(0);
  let panelResizeStartWidth = $state(0);

  /** PERF: Throttle panel/divider/corner resize to one layout update per frame. */
  let resizeMoveRafId = 0;
  let latestMoveEvent = null as MouseEvent | null;

  let toastVisible = $state(false);
  let toastMessage = $state('');
  let toastVariant = $state<'success' | 'error'>('success');
  let presetLoading = $state(false);
  let shortcutsModalOpen = $state(false);
  /** When set, show "Load preset?" confirmation modal; confirm runs load for this preset name. */
  let pendingLoadPresetName = $state<string | null>(null);
  /** When set, show "Import preset?" confirmation modal; confirm runs import with this JSON. */
  let pendingImportJson = $state<string | null>(null);

  // Derived
  const helpEnabled = $derived.by(() => {
    const cb = callbacks.isHelpEnabled;
    if (cb) return cb();
    const g = getGraph();
    const ids = g?.viewState?.selectedNodeIds ?? [];
    return ids.length === 1;
  });

  const fpsColor = $derived(
    fps <= 0 ? 'var(--layout-button-color)' : fps >= 55 ? 'var(--fps-color-good)' : fps >= 30 ? 'var(--fps-color-moderate)' : 'var(--fps-color-poor)'
  );

  const topBarHeight = $derived(buttonContainerEl ? buttonContainerEl.getBoundingClientRect().height : 60);
  const bottomBarHeight = $derived(12);
  const bottomSafeInset = $derived(Math.max(bottomBarHeight, SAFE_DISTANCE));
  const panelOffset = $derived(isPanelVisible ? panelWidth : 0);

  // Show toast helper
  function showToast(message: string, type: 'success' | 'error') {
    toastMessage = message;
    toastVariant = type;
    toastVisible = true;
    if (type === 'success') {
      setTimeout(() => {
        toastVisible = false;
      }, 3000);
    }
  }

  function dismissToast() {
    toastVisible = false;
  }

  function clearToastAfterExit() {
    toastMessage = '';
  }

  // View mode
  function setViewMode(mode: ViewMode) {
    if (viewMode === mode) return;
    viewMode = mode;
  }

  // Panel resize handle: show only after open animation; hide instantly on close
  $effect(() => {
    const visible = isPanelVisible;
    if (panelOpenTimeoutId) {
      window.clearTimeout(panelOpenTimeoutId);
      panelOpenTimeoutId = 0;
    }
    if (visible) {
      panelOpenTimeoutId = window.setTimeout(() => {
        panelOpenTimeoutId = 0;
        showPanelResizeHandle = true;
      }, 300);
    } else {
      showPanelResizeHandle = false;
    }
    return () => {
      if (panelOpenTimeoutId) window.clearTimeout(panelOpenTimeoutId);
    };
  });

  // Divider drag
  function onDividerMouseDown(e: MouseEvent) {
    isDraggingDivider = true;
    e.preventDefault();
  }

  function onPanelResizeMouseDown(e: MouseEvent) {
    isResizingPanel = true;
    panelResizeStartX = e.clientX;
    panelResizeStartWidth = panelWidth;
    e.preventDefault();
  }

  // Global mouse handlers (throttled to one layout update per frame for FPS during panel/split resize)
  $effect(() => {
    if (!isDraggingDivider && !isResizingPanel) return;

    function applyMove(e: MouseEvent) {
      if (isDraggingDivider && containerEl) {
        const rect = containerEl.getBoundingClientRect();
        const availableWidth = rect.width - panelOffset;
        // Split handle sits to the left of the preview (outside it); handle is at split edge - 4px, so keep it under cursor
        const RESIZE_HANDLE_OFFSET_PX = 4;
        const newPos = (e.clientX - rect.left - panelOffset + RESIZE_HANDLE_OFFSET_PX) / availableWidth;
        dividerPosition = Math.max(0.2, Math.min(0.8, newPos));
      } else if (isResizingPanel) {
        const deltaX = e.clientX - panelResizeStartX;
        panelWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, panelResizeStartWidth + deltaX));
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
      isDraggingDivider = false;
      isResizingPanel = false;
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

  // Action handlers
  async function handleCopyPreset() {
    try {
      await callbacks.onCopyPreset?.();
      showToast('Graph copied to clipboard!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to copy graph';
      showToast(msg, 'error');
      globalErrorHandler.report('runtime', 'error', 'Failed to copy graph', { originalError: err instanceof Error ? err : new Error(msg) });
    }
  }

  async function handleExport() {
    try {
      await callbacks.onExport?.();
      showToast('Image exported successfully!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export image';
      showToast(msg, 'error');
      globalErrorHandler.report('runtime', 'error', 'Failed to export image', { originalError: err instanceof Error ? err : new Error(msg) });
    }
  }

  async function handleVideoExport() {
    try {
      await callbacks.onVideoExport?.();
      showToast('Video exported successfully!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export video';
      if (msg === 'Cancelled') return;
      showToast(msg, 'error');
      globalErrorHandler.report('runtime', 'error', msg, { originalError: err instanceof Error ? err : new Error(msg) });
    }
  }

  async function handleLoadPreset(presetName: string) {
    const graph = getGraph();
    if (graph.nodes.length > 0) {
      pendingLoadPresetName = presetName;
      return;
    }
    await doLoadPreset(presetName);
  }

  async function doLoadPreset(presetName: string) {
    try {
      presetLoading = true;
      pendingLoadPresetName = null;
      await callbacks.onLoadPreset?.(presetName);
      showToast(`Loaded preset: ${presetName}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load preset';
      showToast(msg, 'error');
      globalErrorHandler.report('runtime', 'error', 'Failed to load preset', { originalError: err instanceof Error ? err : new Error(msg) });
    } finally {
      presetLoading = false;
    }
  }

  let presetFileInputEl = $state<HTMLInputElement | undefined>(undefined);

  async function handleImportPresetFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !callbacks.onImportPresetFromFile) return;
    const graph = getGraph();
    const json = await file.text();
    if (graph.nodes.length > 0) {
      pendingImportJson = json;
      return;
    }
    await doImportPreset(json);
  }

  async function doImportPreset(json: string) {
    if (!callbacks.onImportPresetFromFile) return;
    try {
      presetLoading = true;
      pendingImportJson = null;
      await callbacks.onImportPresetFromFile(json);
      showToast('Preset imported', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      showToast(msg, 'error');
      globalErrorHandler.report('runtime', 'error', 'Import preset failed', { originalError: err instanceof Error ? err : new Error(msg) });
    } finally {
      presetLoading = false;
    }
  }

  function handlePresetClick(e: MouseEvent) {
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const items: DropdownMenuItem[] = [
      ...presetList.map((p) => ({
        label: p.displayName,
        action: () => handleLoadPreset(p.name),
      })),
      { label: 'Import from file…', action: () => { presetMenuOpen = false; presetFileInputEl?.click(); } },
    ];
    if (presetList.length === 0) items.unshift({ label: 'No presets available', action: () => {}, disabled: true });
    presetMenuX = rect.left;
    presetMenuY = rect.bottom + 4;
    presetMenuItems = items;
    presetMenuOpen = true;
  }

  function handlePresetMenuClose() {
    presetMenuOpen = false;
  }

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  const contentWidth = $derived(containerWidth - panelOffset);

  // ResizeObserver ensures dimensions stay correct when layout changes (e.g. panel toggle, window resize)
  $effect(() => {
    const el = containerEl;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      containerWidth = rect.width;
      containerHeight = rect.height;
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    containerWidth = rect.width;
    containerHeight = rect.height;
    return () => ro.disconnect();
  });

  let zoomClickTimeout: number | null = null;
  function handleZoomClick() {
    if (zoomClickTimeout) {
      clearTimeout(zoomClickTimeout);
      zoomClickTimeout = null;
    }
    zoomClickTimeout = window.setTimeout(() => {
      zoomClickTimeout = null;
      callbacks.onZoomChange?.(1.0);
    }, 250);
  }

  function handleZoomDblClick() {
    if (zoomClickTimeout) {
      clearTimeout(zoomClickTimeout);
      zoomClickTimeout = null;
    }
    const currentZoomPercent = Math.round((callbacks.getZoom?.() ?? 1) * 100);
    const input = window.prompt('Enter zoom percentage:', String(currentZoomPercent));
    if (input !== null) {
      const value = parseFloat(input);
      if (!isNaN(value) && value > 0) {
        const zoomValue = Math.max(0.1, Math.min(1, value / 100));
        callbacks.onZoomChange?.(zoomValue);
      }
    }
  }

  const presetLabel = $derived(
    selectedPreset ? (presetList.find((p) => p.name === selectedPreset)?.displayName ?? selectedPreset) : 'None'
  );

  const zoomPercent = $derived(Math.round(zoom * 100));
</script>

<div
  bind:this={containerEl}
  class="node-editor-layout"
  class:is-resizing-layout={isDraggingDivider || isResizingPanel}
  data-view={viewMode}
  data-preview={viewMode === 'node' ? 'collapsed' : 'expanded'}
  style="position: absolute; inset: 0; --panel-width-dynamic: {panelWidth}px; --top-bar-left-offset: {panelOffset}px; --timeline-viewport-left: {panelOffset}px; --timeline-viewport-width: {containerWidth - panelOffset}px;"
>
  <!-- Top bar -->
  <TopBar
    barElement={(el) => (buttonContainerEl = el)}
    presetLabel={presetLabel}
    presetLoading={presetLoading}
    viewMode={viewMode}
    setViewMode={setViewMode}
    zoomPercent={zoomPercent}
    fps={fps}
    fpsColor={fpsColor}
    helpEnabled={helpEnabled}
    isPanelVisible={isPanelVisible}
    panelOffset={panelOffset}
    onPanelToggle={callbacks.onPanelToggle}
    onPresetClick={handlePresetClick}
    onCopyPreset={handleCopyPreset}
    onExport={handleExport}
    onVideoExport={handleVideoExport}
    isVideoExportSupported={isVideoExportSupported}
    onZoomClick={handleZoomClick}
    onZoomDblClick={handleZoomDblClick}
    onHelpClick={callbacks.onHelpClick}
    onShortcutsClick={() => (shortcutsModalOpen = true)}
  />

  <KeyboardShortcutsModal open={shortcutsModalOpen} onClose={() => (shortcutsModalOpen = false)} />

  <Modal
    open={pendingLoadPresetName !== null}
    onClose={() => (pendingLoadPresetName = null)}
    class="confirm-modal"
  >
    <div class="confirm-content">
      <p>Load preset? This will replace the current graph and clear undo history.</p>
      <div class="confirm-actions">
        <Button variant="secondary" size="sm" onclick={() => (pendingLoadPresetName = null)}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          onclick={() => pendingLoadPresetName != null && doLoadPreset(pendingLoadPresetName)}
        >
          Confirm
        </Button>
      </div>
    </div>
  </Modal>

  <Modal
    open={pendingImportJson !== null}
    onClose={() => (pendingImportJson = null)}
    class="confirm-modal"
  >
    <div class="confirm-content">
      <p>Import preset? This will replace the current graph and clear undo history.</p>
      <div class="confirm-actions">
        <Button variant="secondary" size="sm" onclick={() => (pendingImportJson = null)}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          onclick={() => pendingImportJson != null && doImportPreset(pendingImportJson)}
        >
          Confirm
        </Button>
      </div>
    </div>
  </Modal>

  <DropdownMenu
    open={presetMenuOpen}
    x={presetMenuX}
    y={presetMenuY}
    items={presetMenuItems}
    onClose={handlePresetMenuClose}
  />

  <input
    type="file"
    accept=".json,application/json"
    style="position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;"
    bind:this={presetFileInputEl}
    onchange={handleImportPresetFile}
    aria-label="Import preset from file"
  />

  <!-- Side panel (tabs + content slots) -->
  <SidePanel
    isPanelVisible={isPanelVisible}
    panelWidth={panelWidth}
    activeTab={activeTab}
    onTabChange={(tab) => (activeTab = tab)}
    onPanelToggle={() => callbacks.onPanelToggle?.()}
    nodesPanel={panel}
    docsPanel={docsPanel}
  />

  <!-- Resize handles (same level, above slots so they are never clipped by overflow:hidden on editor/preview) -->
  {#if showPanelResizeHandle}
    <VerticalResizeHandle
      edgeLeft={panelWidth}
      onMouseDown={onPanelResizeMouseDown}
      disableTransition={isResizingPanel}
    />
  {/if}
  {#if viewMode === 'split'}
    <VerticalResizeHandle
      edgeLeft={panelOffset + contentWidth * dividerPosition}
      onMouseDown={onDividerMouseDown}
      disableTransition={isDraggingDivider}
      side="left"
      containerWidth={containerWidth}
    />
  {/if}

  <!-- Node editor slot (z-index below panel so panel draws on top when open; panel uses --z-panel) -->
  <div
    class="node-editor-slot"
    style="
      position: absolute;
      left: {panelOffset}px;
      top: 0;
      bottom: 0;
      overflow: hidden;
      width: {viewMode === 'full' ? 0 : viewMode === 'split' ? contentWidth * dividerPosition : containerWidth - panelOffset}px;
      display: {viewMode === 'full' ? 'none' : 'block'};
      z-index: var(--z-base);
    "
  >
    {#if nodeEditor}
      {@render nodeEditor()}
    {/if}
  </div>

  <!-- Preview slot -->
  <PreviewContainer
    preview={preview}
    viewMode={viewMode}
    panelOffset={panelOffset}
    contentWidth={contentWidth}
    dividerPosition={dividerPosition}
    containerWidth={containerWidth}
    containerHeight={containerHeight}
    topBarHeight={topBarHeight}
    bottomSafeInset={bottomSafeInset}
    containerEl={containerEl}
    disableTransition={isDraggingDivider || isResizingPanel}
  />

  <!-- Bottom bar slot -->
  {#if bottomBar}
    {@render bottomBar(primaryTrackKey)}
  {/if}
</div>

{#if toastMessage}
  <div use:portal style="position: fixed; inset: 0; z-index: 10000; pointer-events: none;">
    <Message visible={toastVisible} variant={toastVariant} onclose={dismissToast} onExited={clearToastAfterExit}>
      <span>{toastMessage}</span>
    </Message>
  </div>
{/if}

<style>
  .confirm-content {
    padding: var(--pd-lg);
    min-width: 280px;
  }

  .confirm-content p {
    margin: 0 0 var(--pd-md);
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--pd-sm);
  }

  /* Panel-affected layout: animate in sync with node panel slide (0.3s ease) */
  .node-editor-layout {
    overflow: visible;

    .node-editor-slot {
      transition: left 0.3s ease, width 0.3s ease;
    }

    /* During divider or panel resize, follow cursor immediately (no transition) */
    &.is-resizing-layout .node-editor-slot {
      transition: none;
    }
  }
</style>