<script lang="ts">
  /**
   * App.svelte - Svelte 5 Migration WP 06
   * Root component: runtime, compiler, graph store, layout, bottom bar, node panel,
   * timeline, curve editor, canvas wrapper, error display, overlays.
   */
  import { onMount, tick } from 'svelte';
  import { loadPhosphorIconData } from '../utils/phosphor-icons-loader';
  import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
  import { createRuntimeManager } from '../runtime/factories';
  import { RuntimeMessageDispatcher } from '../runtime/RuntimeMessageDispatcher';
  import { WaveformService } from '../runtime';
  import { WebGLContextError } from '../runtime/errors';
  import { nodeSystemSpecs } from '../shaders/nodes/index';
  import { createEmptyGraph } from '../data-model/utils';
  import { listPresets, loadPreset, loadPresetFromJson, copyGraphToClipboard } from '../utils/presetManager';
  import { toValidationSpecs } from '../utils/nodeSpecUtils';
  import { exportImage } from '../utils/export';
  import { runVideoExportFlow, isSupported as isVideoExportSupported } from '../video-export';
  import { globalErrorHandler, ErrorUtils } from '../utils/errorHandling';
  import { safeDestroy } from '../utils/Disposable';
  import {
    updateNodeParameter,
    updateAudioFile,
    addAudioFile,
    generateUUID,
    setAutomationDuration,
    setPlaylistCurrentIndex,
    setPlaylistOrder,
    setPrimarySource,
    getPrimaryFileId,
    setLoopCurrentTrack,
    retargetBandsToPrimary,
  } from '../data-model';
  import { getTracksData, getPlaylistOrder } from '../runtime/tracksData';
  import type { NodeGraph } from '../data-model/types';
  import type { AudioSetup } from '../data-model';
  import type { NodeSpec } from '../types';
  import { UndoRedoManager } from '../ui/editor';
  import { errorStore, errorAnnouncer, formatErrorForAnnouncer } from './stores';
  import { ErrorDisplay, ErrorAnnouncer } from './components/ui';
  import { getHelpContent } from '../utils/ContextualHelpManager';
  import type { HelpContent } from '../utils/ContextualHelpManager';

  import NodeEditorLayout from './components/editor/NodeEditorLayout.svelte';
  import BottomBar from './components/bottom-bar/BottomBar.svelte';
  import { NodePanelContent, DocsPanelContent } from './components/side-panel';
  import TimelinePanel from './components/timeline/TimelinePanel.svelte';
  import TimelineCurveEditor from './components/timeline/TimelineCurveEditor.svelte';
  import NodeEditorCanvasWrapper from './components/editor/NodeEditorCanvasWrapper.svelte';
  import EditorParameterValueOverlay from './components/editor/EditorParameterValueOverlay.svelte';
  import EditorLabelEditOverlay from './components/editor/EditorLabelEditOverlay.svelte';
  import { HelpCallout, NodeRightClickMenu, ColorPickerPopover, AudioSignalPicker } from './components';
  import { getStoredPosition, setStoredPosition } from './components/floating-panel';
  import { DropdownMenu } from './components/ui';
  import type { DropdownMenuItem } from './components/ui';
  import type { NodeEditorCanvasWrapperAPI } from './components/editor/NodeEditorCanvasWrapper.types';
  import type { CanvasOverlayBridge, SignalSelectPayload } from './CanvasOverlayBridge';

  import { graphStore } from './stores';

  const nodeSpecs: NodeSpec[] = nodeSystemSpecs;
  let hasInitialFit = false;

  $effect(() => {
    const api = canvasApi;
    const rm = runtimeManager;
    if (!api || !rm) return;
    api.setSpacebarStateChangeCallback((isPressed) => {
      graphStore.setSpacebarPressed(isPressed);
      bottomBarRef?.setSpacebarPressed(isPressed);
    });
    api.setAudioManager(rm.getAudioManager());
    if (!hasInitialFit && graphStore.graph.nodes.length > 0) {
      hasInitialFit = true;
      setTimeout(() => api.fitToView(), 150);
    }
  });

  $effect(() => {
    const rm = runtimeManager;
    if (!rm) return;
    runtimeDispatcher?.setAudioSetup(graphStore.audioSetup);
  });

  $effect(() => {
    const rm = runtimeManager;
    if (!rm) {
      waveformService = null;
      return;
    }
    waveformService = new WaveformService({
      getPrimarySource: () => graphStore.audioSetup?.primarySource,
      getPrimaryFileId: () => getPrimaryFileId(graphStore.audioSetup),
      getPrimaryBuffer: () => {
        const id = getPrimaryFileId(graphStore.audioSetup);
        return id ? (rm.getAudioManager().getAudioNodeState(id)?.audioBuffer ?? null) : null;
      },
    });
  });

  $effect(() => {
    const rm = runtimeManager;
    if (!rm) return;
    rm.setOnPlaylistAdvance((nextState) => {
      const prevPrimaryId = getPrimaryFileId(graphStore.audioSetup);
      let setup = graphStore.audioSetup;
      const order = setup?.playlistState?.order ?? [];
      const trackId = order[nextState.currentIndex];
      if (trackId == null) return;
      setup = setPlaylistCurrentIndex(setup, nextState.currentIndex);
      setup = setPrimarySource(setup, { type: 'playlist', trackId });
      const newPrimaryId = getPrimaryFileId(setup);
      setup = retargetBandsToPrimary(setup, prevPrimaryId, newPrimaryId);
      graphStore.setAudioSetup(setup);
      runtimeDispatcher?.setAudioSetup(setup, { autoPlayWhenReady: true });
      runtimeDispatcher?.playPrimary();
    });
    return () => rm.setOnPlaylistAdvance(undefined);
  });
  const nodeSpecsMap = new Map<string, NodeSpec>(nodeSpecs.map((s) => [s.id, s]));

  let previewMount: HTMLDivElement;
  let compiler = $state<NodeShaderCompiler | null>(null);
  let runtimeManager = $state<Awaited<ReturnType<typeof createRuntimeManager>> | null>(null);
  let runtimeDispatcher = $state<RuntimeMessageDispatcher | null>(null);
  let waveformService = $state<WaveformService | null>(null);
  let undoRedoManager: UndoRedoManager;
  let canvasApi = $state<NodeEditorCanvasWrapperAPI | null>(null);

  /** API exposed by BottomBar via bind:this (exported functions). */
  interface BottomBarRef {
    setSpacebarPressed: (isPressed: boolean) => void;
    setTimelinePanelOpen: (open: boolean) => void;
    isTimelinePanelVisible: () => boolean;
    getTimelinePanelContentElement: () => HTMLElement | null;
    getTimelineCurveEditorSlotElement: () => HTMLElement | null;
    getElement: () => HTMLElement | null;
  }
  let bottomBarRef: BottomBarRef | undefined;

  /** Ref to the nodes tab content (toggle, focusSearch, etc.). */
  let nodePanelRef: { toggle?: () => void; focusSearch?: () => void } | undefined;

  /** API exposed by NodeRightClickMenu via bind:this. */
  interface NodeRightClickMenuRef {
    show: (x: number, y: number, nodeId: string, nodeType: string) => void;
  }
  let nodeRightClickMenuRef: NodeRightClickMenuRef | undefined;

  let curveEditorLaneId = $state<string | null>(null);
  let curveEditorRegionId = $state<string | null>(null);
  let curveEditorLaneLabel = $state<string>('');
  let presets = $state<Array<{ name: string; displayName: string }>>([]);
  let selectedPreset = $state<string | null>(null);
  let isPanelVisible = $state(false);
  let zoom = $state(1.0);
  let fps = $state(0);
  let isVisible = $state(true);
  let animationFrameId = $state<number | null>(null);
  let intersectionObserver: IntersectionObserver | null = null;

  let helpVisible = $state(false);
  let helpScreenX = $state(0);
  let helpScreenY = $state(0);
  let helpPositionMode = $state<'anchor' | 'center'>('center');
  let helpContent = $state<HelpContent | null>(null);
  /** Node type id when help is for a node (e.g. "noise"); used to look up spec for port labels. */
  let helpNodeType = $state<string | undefined>(undefined);

  /** Primary track key for waveform scrubber; derived in App so layout re-renders on track change. */
  const primaryTrackKey = $derived(getPrimaryFileId(graphStore.audioSetup));

  /* Canvas overlay state (for color picker, enum dropdown) */
  let canvasColorPickerVisible = $state(false);
  let canvasColorPickerX = $state(0);
  let canvasColorPickerY = $state(0);
  let canvasColorPickerValue = $state({ l: 0.5, c: 0.2, h: 0 });
  let canvasColorPickerOnApply = $state<((l: number, c: number, h: number) => void) | null>(null);
  /** API exposed by DropdownMenu via bind:this. */
  interface CanvasEnumDropdownRef {
    show: (x: number, y: number, items: DropdownMenuItem[], options?: { openAbove?: boolean; align?: 'start' | 'center'; alignY?: 'start' | 'center'; anchorToSelected?: boolean }) => void;
    hide: () => void;
    isVisible: () => boolean;
  }
  let canvasEnumDropdownRef = $state<CanvasEnumDropdownRef | null>(null);

  let parameterValueOverlayVisible = $state(false);
  let parameterValueOverlayX = $state(0);
  let parameterValueOverlayY = $state(0);
  let parameterValueOverlayWidth = $state(140);
  let parameterValueOverlayHeight = $state(40);
  let parameterValueOverlayValue = $state(0);
  let parameterValueOverlayParamType = $state<'int' | 'float'>('float');
  let parameterValueOverlayOnCommit = $state<((value: number) => void) | null>(null);
  let parameterValueOverlayOnCancel = $state<(() => void) | null>(null);

  let labelEditOverlayVisible = $state(false);
  let labelEditOverlayX = $state(0);
  let labelEditOverlayY = $state(0);
  let labelEditOverlayMinWidth = $state(120);
  let labelEditOverlayLabel = $state<string | undefined>(undefined);
  let labelEditOverlayOnCommit = $state<((label: string | undefined) => void) | null>(null);
  let labelEditOverlayOnCancel = $state<(() => void) | null>(null);

  let signalPickerVisible = $state(false);
  let signalPickerXLarge = $state(0);
  let signalPickerYLarge = $state(0);
  let signalPickerXCompact = $state(0);
  let signalPickerYCompact = $state(0);
  let signalPickerTargetNodeId = $state('');
  let signalPickerTargetParameter = $state('');
  let signalPickerOnSelect = $state<((payload: SignalSelectPayload) => void) | null>(null);
  let signalPickerTriggerElement = $state<HTMLElement | null>(null);

  const overlayBridge: CanvasOverlayBridge = {
    showParameterValueInput(screenX, screenY, value, size, paramType, onCommit, onCancel) {
      parameterValueOverlayX = screenX;
      parameterValueOverlayY = screenY;
      parameterValueOverlayWidth = Math.max(size.width, 140);
      parameterValueOverlayHeight = size.height;
      parameterValueOverlayValue = value;
      parameterValueOverlayParamType = paramType;
      parameterValueOverlayOnCommit = onCommit;
      parameterValueOverlayOnCancel = onCancel;
      parameterValueOverlayVisible = true;
    },
    hideParameterValueInput() {
      parameterValueOverlayVisible = false;
      parameterValueOverlayOnCommit = null;
      parameterValueOverlayOnCancel = null;
    },
    isParameterValueInputActive() {
      return parameterValueOverlayVisible;
    },
    showLabelEditInput(screenX, screenY, label, size, onCommit, onCancel) {
      labelEditOverlayX = screenX;
      labelEditOverlayY = screenY;
      labelEditOverlayMinWidth = Math.max(size.width, 120);
      labelEditOverlayLabel = label;
      labelEditOverlayOnCommit = onCommit;
      labelEditOverlayOnCancel = onCancel;
      labelEditOverlayVisible = true;
    },
    hideLabelEditInput() {
      labelEditOverlayVisible = false;
      labelEditOverlayOnCommit = null;
      labelEditOverlayOnCancel = null;
    },
    isLabelEditInputActive() {
      return labelEditOverlayVisible;
    },
    showColorPicker(_nodeId, initial, screenX, screenY, onApply) {
      canvasColorPickerValue = initial;
      canvasColorPickerX = screenX;
      canvasColorPickerY = screenY;
      canvasColorPickerOnApply = onApply;
      canvasColorPickerVisible = true;
    },
    hideColorPicker() {
      canvasColorPickerVisible = false;
      canvasColorPickerOnApply = null;
    },
    isColorPickerVisible() {
      return canvasColorPickerVisible;
    },
    showEnumDropdown(screenX, screenY, items, _onSelect, options) {
      canvasEnumDropdownRef?.show(screenX, screenY, items, options);
    },
    hideEnumDropdown() {
      canvasEnumDropdownRef?.hide();
    },
    isEnumDropdownVisible() {
      return canvasEnumDropdownRef?.isVisible?.() ?? false;
    },
    showSignalPicker(_screenX, _screenY, targetNodeId, targetParameter, onSelect, triggerElement) {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const posLarge = getStoredPosition('audio-signal-picker', {
        variant: 'large',
        fallback: center,
        legacyKey: [
          'shader-composer.audioSignalPickerPositionLarge',
          'shader-composer.audioSignalPickerPosition',
        ],
      });
      const posCompact = getStoredPosition('audio-signal-picker', {
        variant: 'compact',
        fallback: center,
        legacyKey: [
          'shader-composer.audioSignalPickerPositionCompact',
          'shader-composer.audioSignalPickerPosition',
        ],
      });
      signalPickerXLarge = posLarge.x;
      signalPickerYLarge = posLarge.y;
      signalPickerXCompact = posCompact.x;
      signalPickerYCompact = posCompact.y;
      signalPickerTargetNodeId = targetNodeId;
      signalPickerTargetParameter = targetParameter;
      signalPickerOnSelect = onSelect;
      signalPickerTriggerElement = triggerElement ?? null;
      signalPickerVisible = true;
    },
    hideSignalPicker() {
      signalPickerVisible = false;
      signalPickerOnSelect = null;
      signalPickerTriggerElement = null;
    },
    isSignalPickerVisible() {
      return signalPickerVisible;
    },
  };

  function remapGraphIds(g: NodeGraph): NodeGraph {
    const newGraphId = `graph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const nodeIdMap = new Map<string, string>();
    const nodes = g.nodes.map((n) => {
      const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      nodeIdMap.set(n.id, newId);
      return { ...n, id: newId };
    });
    const connections = g.connections.map((c) => ({
      ...c,
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceNodeId: nodeIdMap.get(c.sourceNodeId) ?? c.sourceNodeId,
      targetNodeId: nodeIdMap.get(c.targetNodeId) ?? c.targetNodeId,
    }));
    const automation =
      g.automation == null
        ? undefined
        : {
            ...g.automation,
            lanes: g.automation.lanes.map((lane) => ({
              ...lane,
              nodeId: nodeIdMap.get(lane.nodeId) ?? lane.nodeId,
            })),
          };
    return {
      ...g,
      id: newGraphId,
      nodes,
      connections,
      ...(automation !== undefined && { automation }),
      viewState: {
        ...(g.viewState ?? { zoom: 1, panX: 0, panY: 0, selectedNodeIds: [] }),
        selectedNodeIds: [],
      },
    };
  }

  async function loadInitialPreset(): Promise<NodeGraph> {
    try {
      const list = await listPresets();
      presets = list;
      const selected = list.find((p) => p.name === 'vector-field-noise') ?? list[0];
      if (!selected) return createEmptyGraph('Untitled');
      const result = await loadPreset(selected.name, toValidationSpecs(nodeSpecs));
      if (!result.graph) {
        if (result.errors.length > 0) console.warn('[App] Preset validation:', result.errors);
        return createEmptyGraph('Untitled');
      }
      selectedPreset = selected.name;
      const remapped = remapGraphIds(result.graph);
      graphStore.setAudioSetup(result.audioSetup ?? { files: [], bands: [], remappers: [] });
      return remapped;
    } catch (err) {
      console.warn('[App] Failed to load preset:', err);
      return createEmptyGraph('Untitled');
    }
  }

  async function applyStartingTrack(
    audioSetup: AudioSetup,
    startingTrackId: string
  ): Promise<AudioSetup> {
    const data = await getTracksData();
    const order = getPlaylistOrder(data);
    let setup = setPlaylistOrder(audioSetup, order);
    setup = setPrimarySource(setup, { type: 'playlist', trackId: startingTrackId });
    const idx = order.indexOf(startingTrackId);
    setup = setPlaylistCurrentIndex(setup, idx >= 0 ? idx : 0);
    return setup;
  }

  async function handleLoadPreset(presetName: string): Promise<void> {
    const result = await loadPreset(presetName, toValidationSpecs(nodeSpecs));
    if (!result.graph) {
      throw new Error(result.errors[0] ?? `Failed to load preset: ${presetName}`);
    }
    const remapped = remapGraphIds(result.graph);
    let audioSetup = result.audioSetup ?? { files: [], bands: [], remappers: [] };
    if (result.startingTrackId) {
      audioSetup = await applyStartingTrack(audioSetup, result.startingTrackId);
    }
    selectedPreset = presetName;
    undoRedoManager.clear();
    graphStore.setGraph(remapped);
    graphStore.setAudioSetup(audioSetup);
    if (runtimeDispatcher) {
      await runtimeDispatcher.setAudioSetup(audioSetup);
      await runtimeDispatcher.loadGraph(remapped);
    }
    if (remapped.nodes.length > 0) {
      setTimeout(() => canvasApi?.fitToView(), 0);
    }
  }

  async function handleImportPresetFromFile(json: string): Promise<void> {
    const result = await loadPresetFromJson(json, toValidationSpecs(nodeSpecs));
    if (!result.graph) {
      throw new Error(result.errors[0] ?? 'Invalid preset file');
    }
    const remapped = remapGraphIds(result.graph);
    let audioSetup = result.audioSetup ?? { files: [], bands: [], remappers: [] };
    if (result.startingTrackId) {
      audioSetup = await applyStartingTrack(audioSetup, result.startingTrackId);
    }
    selectedPreset = null;
    undoRedoManager.clear();
    graphStore.setGraph(remapped);
    graphStore.setAudioSetup(audioSetup);
    if (runtimeDispatcher) {
      await runtimeDispatcher.setAudioSetup(audioSetup);
      await runtimeDispatcher.loadGraph(remapped);
    }
    if (remapped.nodes.length > 0) {
      setTimeout(() => canvasApi?.fitToView(), 0);
    }
  }

  function handleCopyPreset(): Promise<void> {
    return copyGraphToClipboard(graphStore.graph, graphStore.audioSetup);
  }

  async function handleExport(): Promise<void> {
    if (!compiler) return;
    await exportImage(graphStore.graph, compiler, {
      resolution: [1600, 1600],
      format: 'png',
      quality: 1.0,
    });
  }

  async function handleVideoExport(): Promise<void> {
    if (!isVideoExportSupported()) {
      throw new Error('Video export is not supported. WebCodecs (VideoEncoder/AudioEncoder) is required.');
    }
    const graph = graphStore.graph;
    const audioManager = runtimeManager?.getAudioManager();
    const getPrimaryAudio = (): { nodeId: string; buffer: AudioBuffer } | null => {
      if (!audioManager) return null;
      const primaryId = getPrimaryFileId(graphStore.audioSetup);
      if (primaryId) {
        const state = audioManager.getAudioNodeState(primaryId);
        if (state?.audioBuffer) return { nodeId: primaryId, buffer: state.audioBuffer };
      }
      return null;
    };
    await runVideoExportFlow({
      graph,
      audioSetup: graphStore.audioSetup,
      compiler: compiler!,
      getPrimaryAudio,
    });
  }

  function startAnimation(): void {
    if (!isVisible || !runtimeManager || animationFrameId !== null) return;
    const ZOOM_UPDATE_INTERVAL = 100;
    let lastFrameTime = performance.now();
    let lastZoomUpdate = lastFrameTime;

    const animate = () => {
      if (!isVisible || !runtimeManager) {
        animationFrameId = null;
        return;
      }
      const now = performance.now();
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;
      fps = frameTime > 0 ? 1000 / frameTime : 0;

      if (now - lastZoomUpdate >= ZOOM_UPDATE_INTERVAL) {
        lastZoomUpdate = now;
        zoom = canvasApi?.getViewState().zoom ?? 1;
      }

      const time = (now / 1000.0) % 1000.0;
      runtimeManager.setTime(time);
      // Node editor canvas redraws on user interaction (pan, zoom, drag, etc.) - no need to redraw every frame
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
  }

  function stopAnimation(): void {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  onMount(() => {
    let cancelled = false;

    (async () => {
      await loadPhosphorIconData();
      await tick();
      if (cancelled) return;

      globalErrorHandler.onError((err: import('../utils/errorHandling').AppError) => {
        // Only show warning/error in toasts; info is for console (e.g. "Already loading audio... skipping duplicate load")
        if (err.severity !== 'info') {
          errorStore.add(err);
          errorAnnouncer.announce(formatErrorForAnnouncer(err));
        }
      });

      const comp = new NodeShaderCompiler(nodeSpecsMap);
      compiler = comp;

      const mount = previewMount;
      if (!mount) {
        console.error('[App] Preview mount not found');
        return;
      }
      if (cancelled) return;

      const previewCanvas = document.createElement('canvas');
      previewCanvas.style.cssText = 'width: 100%; height: 100%; display: block;';
      mount.appendChild(previewCanvas);

      const showWebGLUnsupported = (err: WebGLContextError): void => {
        mount.removeChild(previewCanvas);
        const msg = document.createElement('div');
        msg.style.cssText = `
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        padding: 24px; text-align: center; color: var(--text-muted, #888);
        font-size: 14px; line-height: 1.5;
      `;
        msg.textContent = 'WebGL2 is not available here. Try a normal (non‑incognito) window, enable hardware acceleration in browser settings, or use Chrome/Firefox/Edge.';
        mount.appendChild(msg);
        globalErrorHandler.reportError(
          ErrorUtils.webglError('WebGL2 not supported.', { originalError: err })
        );
      };

      let rm: Awaited<ReturnType<typeof createRuntimeManager>>;
      try {
        rm = await createRuntimeManager(previewCanvas, comp, globalErrorHandler, nodeSpecsMap);
        runtimeManager = rm;
        runtimeDispatcher = new RuntimeMessageDispatcher(rm);
        waveformService = new WaveformService({
          getPrimarySource: () => graphStore.audioSetup?.primarySource,
          getPrimaryFileId: () => getPrimaryFileId(graphStore.audioSetup),
          getPrimaryBuffer: () => {
            const id = getPrimaryFileId(graphStore.audioSetup);
            return id ? rm.getAudioManager().getAudioNodeState(id)?.audioBuffer ?? null : null;
          },
        });
      } catch (err) {
        if (err instanceof WebGLContextError) {
          showWebGLUnsupported(err);
          return;
        }
        throw err;
      }
      if (cancelled) return;

      rm.setOnContextLost(() => stopAnimation());
      rm.setOnAppContextRestored(() => startAnimation());

      undoRedoManager = new UndoRedoManager();
      graphStore.setGraphChangedListener((g) => undoRedoManager.pushState(g));

      const initialGraph = await loadInitialPreset();
      if (cancelled) return;
      graphStore.setGraph(initialGraph);
      runtimeDispatcher?.setAudioSetup(graphStore.audioSetup);
      await runtimeDispatcher?.loadGraph(initialGraph);
      if (cancelled) return;

      document.addEventListener('visibilitychange', () => {
        isVisible = !document.hidden;
        if (!isVisible) stopAnimation();
        else startAnimation();
      });

      intersectionObserver = new IntersectionObserver((entries) => {
        const iv = entries[0].isIntersecting;
        isVisible = iv && !document.hidden;
        if (!isVisible) stopAnimation();
        else startAnimation();
      }, { threshold: 0.1 });
      intersectionObserver.observe(previewCanvas);

      startAnimation();
    })();

    return () => {
      cancelled = true;
      stopAnimation();
      intersectionObserver?.disconnect();
      safeDestroy(runtimeManager);
      runtimeManager = null;
      waveformService = null;
    };
  });
</script>

<svelte:window />

{#snippet timelinePanelSnippet()}
  <TimelinePanel
    getGraph={() => graphStore.graph}
    onGraphUpdate={async (g) => {
      graphStore.setGraph(g);
      await runtimeDispatcher?.loadGraph(g);
    }}
    getTimelineState={() => runtimeManager?.getTimelineState() ?? null}
    onSeek={(t) => runtimeManager?.seekGlobalAudio(t)}
    waveformService={waveformService}
    onOpenCurveEditor={(laneId, regionId, laneLabel) => {
      curveEditorLaneId = laneId;
      curveEditorRegionId = regionId;
      curveEditorLaneLabel = laneLabel;
    }}
    onClose={() => bottomBarRef?.setTimelinePanelOpen(false)}
    nodeSpecs={nodeSpecs}
  />
{/snippet}

{#snippet curveEditorSlotSnippet()}
  {#if curveEditorLaneId && curveEditorRegionId}
    <TimelineCurveEditor
      getGraph={() => graphStore.graph}
      onGraphUpdate={async (g) => {
        graphStore.setGraph(g);
        await runtimeDispatcher?.loadGraph(g);
      }}
      onClose={() => {
        curveEditorLaneId = null;
        curveEditorRegionId = null;
        curveEditorLaneLabel = '';
      }}
      laneId={curveEditorLaneId}
      regionId={curveEditorRegionId}
      laneLabel={curveEditorLaneLabel}
      nodeSpecs={nodeSpecs}
      getWaveformData={waveformService ? async () => waveformService!.getWaveformForPrimary() : undefined}
    />
  {/if}
{/snippet}

<div class="app-root" style="position: fixed; inset: 0; overflow: hidden; background: var(--layout-bg, #1a1a1a);">
  <ErrorDisplay />
  <ErrorAnnouncer />

  <NodeEditorLayout
    presetList={presets}
    selectedPreset={selectedPreset}
    primaryTrackKey={primaryTrackKey}
    isPanelVisible={isPanelVisible}
    zoom={zoom}
    fps={fps}
    isVideoExportSupported={isVideoExportSupported()}
    callbacks={{
      onCopyPreset: handleCopyPreset,
      onExport: handleExport,
      onVideoExport: handleVideoExport,
      onLoadPreset: handleLoadPreset,
      onImportPresetFromFile: handleImportPresetFromFile,
      onZoomChange: (z) => canvasApi?.setZoom(z),
      getZoom: () => canvasApi?.getViewState().zoom ?? 1,
      isHelpEnabled: () => (graphStore.graph.viewState?.selectedNodeIds?.length ?? 0) === 1,
      onHelpClick: async () => {
        const ids = graphStore.graph.viewState?.selectedNodeIds ?? [];
        if (ids.length !== 1) return;
        const nodeId = ids[0];
        const node = graphStore.graph.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const content = await getHelpContent(`node:${node.type}`);
        helpContent = content;
        helpNodeType = node.type;
        const center = canvasApi?.getCanvasCenterInScreen() ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const pos = getStoredPosition('help-panel', {
          fallback: center,
          legacyKey: 'shader-composer.helpPanelPosition',
        });
        helpScreenX = pos.x;
        helpScreenY = pos.y;
        helpPositionMode = 'center';
        helpVisible = true;
      },
      onPanelToggle: () => {
        isPanelVisible = !isPanelVisible;
        nodePanelRef?.toggle?.();
      },
    }}
  >
    {#snippet preview()}
      <div bind:this={previewMount} style="width: 100%; height: 100%;"></div>
    {/snippet}

    {#snippet nodeEditor()}
      {@const graph = graphStore.graph}
      <NodeEditorCanvasWrapper
        nodeSpecs={nodeSpecs}
        graph={graph}
        bind:api={canvasApi}
        overlayBridge={overlayBridge}
        getTimelineCurrentTime={() => runtimeManager?.getTimelineState()?.currentTime ?? 0}
        getTimelineState={() => runtimeManager?.getTimelineState() ?? null}
        callbacks={{
          onGraphChanged: async (g) => {
            await runtimeDispatcher?.loadGraph(g);
          },
          onConnectionRemoved: () => {},
          onNodeContextMenu: (x, y, nodeId, nodeType) => {
            nodeRightClickMenuRef?.show(x, y, nodeId, nodeType);
          },
          onParameterChanged: async (nodeId, paramName, value, g) => {
            if (!g) return;
            await runtimeDispatcher?.updateParameter(nodeId, paramName, value, g);
          },
          onFileParameterChanged: async (nodeId, paramName, file) => {
            await runtimeDispatcher?.updateAudioFileParameter(nodeId, paramName, file);
            const up = updateNodeParameter(graphStore.graph, nodeId, paramName, file.name);
            graphStore.setGraph(up);
          },
          onFileDialogOpen: () => stopAnimation(),
          onFileDialogClose: () => startAnimation(),
          onSelectionChanged: (ids) => {
            graphStore.updateViewState({ selectedNodeIds: ids });
          },
          isDialogVisible: () => bottomBarRef?.isTimelinePanelVisible() ?? false,
        }}
      />
    {/snippet}

    {#snippet panel()}
      <NodePanelContent
        bind:this={nodePanelRef}
        nodeSpecs={nodeSpecs}
        onCreateNode={(nodeType, canvasX, canvasY) => {
          const node = canvasApi?.addNode(nodeType, canvasX, canvasY);
          if (node) {
            runtimeDispatcher?.loadGraph(graphStore.graph);
          }
        }}
        onScreenToCanvas={(sx, sy) => canvasApi?.screenToCanvas(sx, sy) ?? { x: 0, y: 0 }}
      />
    {/snippet}

    {#snippet docsPanel()}
      <DocsPanelContent />
    {/snippet}

    {#snippet bottomBar(primaryTrackKey)}
      <BottomBar
        bind:this={bottomBarRef}
        primaryTrackKey={primaryTrackKey}
        getState={() => runtimeManager?.getTimelineState() ?? null}
        getWaveformForPrimary={waveformService ? () => waveformService!.getWaveformForPrimary() : undefined}
        onPlayToggle={() => runtimeDispatcher?.toggleGlobalAudioPlayback()}
        loopCurrentTrack={graphStore.audioSetup?.playlistState?.loopCurrentTrack ?? false}
        onLoopToggle={() => {
          const setup = setLoopCurrentTrack(graphStore.audioSetup, !(graphStore.audioSetup?.playlistState?.loopCurrentTrack));
          graphStore.setAudioSetup(setup);
          runtimeDispatcher?.setAudioSetup(setup);
          const state = runtimeManager?.getTimelineState();
          if (state?.isPlaying) {
            runtimeDispatcher?.toggleGlobalAudioPlayback();
            runtimeDispatcher?.toggleGlobalAudioPlayback();
          }
        }}
        onSkipBack={() => runtimeDispatcher?.playPrevious()}
        onSkipForward={() => runtimeDispatcher?.playNext()}
        onTimeChange={(t) => runtimeDispatcher?.seekGlobalAudio(t)}
        onToolChange={(tool) => {
          graphStore.setActiveTool(tool);
          canvasApi?.setActiveTool(tool);
        }}
        onTimelinePanelOpen={() => {}}
        audioSetup={graphStore.audioSetup}
        getTrackKey={() => getPrimaryFileId(graphStore.audioSetup)}
        getPrimaryAudioFileNodeId={() => getPrimaryFileId(graphStore.audioSetup) ?? 'primary'}
        onSelectTrack={async (trackId) => {
          const prevPrimaryId = getPrimaryFileId(graphStore.audioSetup);
          const data = await getTracksData();
          const order = getPlaylistOrder(data);
          let setup = graphStore.audioSetup;
          setup = setPlaylistOrder(setup, order);
          setup = setPrimarySource(setup, { type: 'playlist', trackId });
          const idx = order.indexOf(trackId);
          setup = setPlaylistCurrentIndex(setup, idx >= 0 ? idx : 0);
          const newPrimaryId = getPrimaryFileId(setup);
          setup = retargetBandsToPrimary(setup, prevPrimaryId, newPrimaryId);
          graphStore.setAudioSetup(setup);
          runtimeDispatcher?.setAudioSetup(setup, { autoPlayWhenReady: true });
        }}
        onAudioFileSelected={async (nodeId, file) => {
          let setup = graphStore.audioSetup;
          let targetFileId: string | undefined = nodeId === 'primary' ? (getPrimaryFileId(setup) ?? undefined) : nodeId;
          if (setup.files.length === 0) {
            const newFile = {
              id: `file-${generateUUID()}`,
              name: file.name.replace(/\.[^/.]+$/, '') || file.name,
              filePath: file.name,
              autoPlay: false,
            };
            setup = addAudioFile(setup, newFile);
            setup = setPrimarySource(setup, { type: 'upload', file: newFile });
            graphStore.setAudioSetup(setup);
            targetFileId = newFile.id;
          }
          if (!targetFileId) return;
          const am = runtimeManager?.getAudioManager();
          if (am) await am.loadAudioFile(targetFileId, file);
          graphStore.setAudioSetup(
            updateAudioFile(graphStore.audioSetup, targetFileId, (f) => ({
              ...f,
              filePath: file.name,
              name: file.name.replace(/\.[^/.]+$/, '') || file.name,
            }))
          );
          // Sync timeline duration from primary audio when the loaded file is the primary track
          const primaryFileId = getPrimaryFileId(graphStore.audioSetup);
          if (primaryFileId != null && targetFileId === primaryFileId && runtimeManager) {
            const globalState = runtimeManager.getGlobalAudioState();
            if (globalState != null && globalState.duration > 0) {
              const updated = setAutomationDuration(graphStore.graph, globalState.duration);
              graphStore.setGraph(updated);
              await runtimeDispatcher?.loadGraph(updated);
            }
          }
        }}
        timelinePanel={timelinePanelSnippet}
        curveEditorSlot={curveEditorSlotSnippet}
      />
    {/snippet}
  </NodeEditorLayout>

  <NodeRightClickMenu
    bind:this={nodeRightClickMenuRef}
    onReadGuide={(_nodeId, nodeType) => {
      const center = canvasApi?.getCanvasCenterInScreen() ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const pos = getStoredPosition('help-panel', {
        fallback: center,
        legacyKey: 'shader-composer.helpPanelPosition',
      });
      getHelpContent(`node:${nodeType}`).then((content) => {
        helpContent = content;
        helpNodeType = nodeType;
        helpScreenX = pos.x;
        helpScreenY = pos.y;
        helpPositionMode = 'center';
        helpVisible = true;
      });
    }}
    onCopyNodeName={(nodeType) => navigator.clipboard.writeText(nodeType).catch(() => {})}
    onRemove={(nodeId) => {
      graphStore.removeNode(nodeId);
      runtimeManager?.setGraph(graphStore.graph);
      canvasApi?.requestRender();
    }}
  />

  <HelpCallout
    visible={helpVisible}
    screenX={helpScreenX}
    screenY={helpScreenY}
    positionMode={helpPositionMode}
    content={helpContent}
    helpNodeType={helpNodeType}
    nodeSpecs={nodeSpecsMap}
    onClose={() => { helpVisible = false; helpNodeType = undefined; }}
    onPositionChange={(x, y) => {
      helpScreenX = x;
      helpScreenY = y;
      setStoredPosition('help-panel', x, y);
    }}
  />

  <ColorPickerPopover
    visible={canvasColorPickerVisible}
    x={canvasColorPickerX}
    y={canvasColorPickerY}
    value={canvasColorPickerValue}
    onChange={(l, c, h) => canvasColorPickerOnApply?.(l, c, h)}
    onClose={() => {
      canvasColorPickerVisible = false;
      canvasColorPickerOnApply = null;
    }}
  />

  <EditorParameterValueOverlay
    visible={parameterValueOverlayVisible}
    x={parameterValueOverlayX}
    y={parameterValueOverlayY}
    width={parameterValueOverlayWidth}
    height={parameterValueOverlayHeight}
    value={parameterValueOverlayValue}
    paramType={parameterValueOverlayParamType}
    onCommit={(value) => {
      parameterValueOverlayOnCommit?.(value);
      parameterValueOverlayVisible = false;
      parameterValueOverlayOnCommit = null;
      parameterValueOverlayOnCancel = null;
    }}
    onCancel={() => {
      parameterValueOverlayOnCancel?.();
      parameterValueOverlayVisible = false;
      parameterValueOverlayOnCommit = null;
      parameterValueOverlayOnCancel = null;
    }}
  />

  <EditorLabelEditOverlay
    visible={labelEditOverlayVisible}
    x={labelEditOverlayX}
    y={labelEditOverlayY}
    minWidth={labelEditOverlayMinWidth}
    label={labelEditOverlayLabel}
    onCommit={(label) => {
      labelEditOverlayOnCommit?.(label);
      labelEditOverlayVisible = false;
      labelEditOverlayOnCommit = null;
      labelEditOverlayOnCancel = null;
    }}
    onCancel={() => {
      labelEditOverlayOnCancel?.();
      labelEditOverlayVisible = false;
      labelEditOverlayOnCommit = null;
      labelEditOverlayOnCancel = null;
    }}
  />

  <DropdownMenu bind:this={canvasEnumDropdownRef} class="canvas-enum-dropdown" />

  <AudioSignalPicker
    open={signalPickerVisible}
    xLarge={signalPickerXLarge}
    yLarge={signalPickerYLarge}
    xCompact={signalPickerXCompact}
    yCompact={signalPickerYCompact}
    onPositionChangeLarge={(x, y) => {
      signalPickerXLarge = x;
      signalPickerYLarge = y;
      setStoredPosition('audio-signal-picker', x, y, 'large');
    }}
    onPositionChangeCompact={(x, y) => {
      signalPickerXCompact = x;
      signalPickerYCompact = y;
      setStoredPosition('audio-signal-picker', x, y, 'compact');
    }}
    targetNodeId={signalPickerTargetNodeId}
    targetParameter={signalPickerTargetParameter}
    triggerElement={signalPickerTriggerElement}
    graph={graphStore.graph}
    audioSetup={graphStore.audioSetup}
    nodeSpecs={nodeSpecsMap}
    getAudioManager={() => runtimeManager?.getAudioManager() ?? null}
    onSelect={(payload) => {
      signalPickerOnSelect?.(payload);
      if (signalPickerTriggerElement) {
        signalPickerTriggerElement.focus();
      }
      signalPickerVisible = false;
      signalPickerOnSelect = null;
      signalPickerTriggerElement = null;
    }}
    onClose={() => {
      if (signalPickerTriggerElement) {
        signalPickerTriggerElement.focus();
      }
      signalPickerVisible = false;
      signalPickerOnSelect = null;
      signalPickerTriggerElement = null;
    }}
    onAudioSetupChange={(setup) => graphStore.setAudioSetup(setup)}
  />
</div>
